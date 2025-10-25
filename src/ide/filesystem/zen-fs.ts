import { getWebContainer } from "@/components/container";
import type { FSDirectory, FSNode } from "@/ide/filesystem";
import { useFileSystem } from "@/ide/filesystem";
import { useEditorState } from "@/ide/editor";
import { bufferWatchEvents } from "@/lib/utils/buffer";
import { getEncoding } from "@/lib/utils/istextorbinary";
import type { DirectoryNode, FileNode, FileSystemTree, SymlinkNode } from "@webcontainer/api";
import { WebContainer } from "@webcontainer/api";
import { configure } from "@zenfs/core";
import zenFs from "@zenfs/core";
import { IndexedDB } from '@zenfs/dom';
import { useIDERouter } from "../router";

// File change notification system
type FileChangeListener = (path: string, content: string) => void;
const fileChangeListeners = new Map<string, Set<FileChangeListener>>();

export function subscribeToFileChanges(path: string, listener: FileChangeListener) {
  if (!fileChangeListeners.has(path)) {
    fileChangeListeners.set(path, new Set());
  }
  fileChangeListeners.get(path)!.add(listener);
  
  return () => {
    const listeners = fileChangeListeners.get(path);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        fileChangeListeners.delete(path);
      }
    }
  };
}

function notifyFileChange(path: string, buffer: Uint8Array) {
  const listeners = fileChangeListeners.get(path);
  if (listeners && listeners.size > 0) {
    // Only notify if the file is text (not binary)
    if (!isBinaryFile(buffer)) {
      const content = Buffer.from(buffer).toString('utf-8');
      listeners.forEach(listener => listener(path, content));
    }
  }
}

// const utf8TextDecoder = new TextDecoder('utf8', { fatal: true });
const FS_IGNORE_PATHS = ["**/node_modules", ".git"]
class ZenFileSystemHandler {
  constructor() {}

  async init()  {
    await configure({
      mounts: {
        "/": IndexedDB
      }
    })
    zenFs.writeFileSync("/test.txt", "Hello World");

    const setFiles = useFileSystem.getState().setFiles;
    const { editorFiles } = await this.buildFileTree();
    setFiles({ directory: editorFiles, open: true });
  }

  async buildFileTree() {
    const buildTree = async (path: string): Promise<{ result: DirectoryNode | FileNode | SymlinkNode, editorState: FSNode }> => {
      const stats = zenFs.statSync(path);
      
      if (stats.isSymbolicLink()) {
        const target = zenFs.readlinkSync(path).toString('utf-8');
        return {
          result: {
            file: {
              symlink: target
            }
          },
          editorState: {
            symlink: {
              target
            }
          }
        };
      }
        
      if (stats.isFile()) {
        const buff = zenFs.readFileSync(path);
        return {
          result: {
            file: {
              contents: buff
            }
          },
          editorState: {
            file: {
              size: stats.size,
              isBinary: isBinaryFile(buff)
            }
          }
        };
      }
        
      if (stats.isDirectory()) {
        const entries = zenFs.readdirSync(path);
        const webContainerTree: FileSystemTree = {};
        const editorTree: { [key: string]: FSNode } = {};
        
        const buildPromises = entries.map(async (entry) => {
          const fullPath = path === '/' ? `/${entry}` : `${path}/${entry}`;
          const { result, editorState } = await buildTree(fullPath);
          return { entry, result, editorState };
        });

        const results = await Promise.all(buildPromises);
        
        for (const { entry, result, editorState } of results) {
          webContainerTree[entry] = result;
          editorTree[entry] = editorState;
        }
        
        return {
          result: { directory: webContainerTree },
          editorState: { directory: editorTree, open: false } // TODO: maybe persist this? Would be slow...
        };
      }
      
      throw new Error(`Unsupported file type at path: ${path}`);
    };

    const dirs = zenFs.readdirSync("/"); // TODO: implement projects by instead reading from /<project>/*
    const buildPromises = dirs.map(async (dir) => {
      const { result, editorState } = await buildTree(`/${dir}`);
      return { dir, result, editorState };
    });

    const results = await Promise.all(buildPromises);
    
    const files: FileSystemTree = {};
    const editorFiles: { [key: string]: FSNode } = {};
    for (const { dir, result, editorState } of results) {
      files[dir] = result;
      editorFiles[dir] = editorState;
    }

    return { files, editorFiles };
  }

  async mountWebContainer(webContainer: WebContainer) {
    const { files } = await this.buildFileTree();
    await webContainer.mount(files, { mountPoint: "/" });
    console.log("mounted, watching paths...");
    webContainer.internal.watchPaths(
      { include: [`/home/workspace/**`], exclude: FS_IGNORE_PATHS, includeContent: true},
      bufferWatchEvents(100, (events) => {
        const watchEvents = events.flat(2);
        const traversePath = (sanitizedPath: string) => {
          // update editor state
          const editorFiles = { ...useFileSystem.getState().files };
          // recurse to the parent
          let current: FSDirectory = editorFiles;
          const parts = sanitizedPath.split('/').filter(Boolean);
          for (let i = 0; i < parts.length - 1; i++) {
            if (!('directory' in current)) {
              console.error(" -> error adding dir, reached a file when dir was expected??", sanitizedPath, current);
              return { current: undefined, parts: undefined, editorFiles: undefined };
            }
            const part = parts[i];
            if (part) {
              current = current.directory[part] as FSDirectory;
            }
          }
          return { current, parts, editorFiles };
        }
        for (const { type, path, buffer } of watchEvents) { // TODO: Clean up this code!!
          console.log(type, path, buffer);
          // remove trailing slash
          let sanitizedPath = path.replace(/\/+$/g, "");
          if (!sanitizedPath.startsWith("/home/workspace")) {
            continue;
          }
          // remove leading /home/workspace
          sanitizedPath = sanitizedPath.substring("/home/workspace".length);
      
          switch (type) {
            case "add_dir": {
              // propagate to zenfs
              zenFs.mkdirSync(sanitizedPath);
              const { current, parts, editorFiles } = traversePath(sanitizedPath);
              if (!current || !parts || parts.length === 0) {
                console.error("[x] error adding dir, could not traverse path", sanitizedPath);
                break;
              }
              const lastPart = parts[parts.length - 1];
              if (lastPart) {
                current.directory[lastPart] = { directory: {}, open: false };
              }
              useFileSystem.getState().setFiles(editorFiles);
              break;
            }
            case "remove_dir": {
              // propagate to zenfs
              console.log(" -> removing", sanitizedPath);
              try {
                const recursiveRemove = async (path: string) => {
                  const files = zenFs.readdirSync(path);
                  if (files.length > 0) {
                    for (const file of files) {
                      await recursiveRemove(`${path}/${file}`).catch((e) => {
                        console.log(" -> [1] error removing", sanitizedPath, e);
                      });
                    }
                  }
                  // check if path is valid
                  if (zenFs.existsSync(path)) {
                    await zenFs.promises.rm(path, { recursive: true });
                  }
                }
                recursiveRemove(sanitizedPath).then(() => {
                  console.log(" -> removed", sanitizedPath);
                }).catch((error) => {
                  console.log(" -> error removing", sanitizedPath, error);
                });
              } catch (error) {
                console.log(" -> error removing", sanitizedPath, error);
              }
              
              // update editor state
              const { current, parts, editorFiles } = traversePath(sanitizedPath);
              if (!current || !parts || !editorFiles || parts.length === 0) {
                console.error("[x] error removing dir, could not traverse path", sanitizedPath);
                break;
              }
              const lastPart = parts[parts.length - 1];
              if (lastPart) {
                delete current.directory[lastPart];
              }
              useFileSystem.getState().setFiles(editorFiles);
              break;
            }
            case "add_file":
            case "change": {
              if (!buffer) {
                throw new Error("Buffer is undefined");
              }
              const isChange = type === "change";
              const isBinary = isBinaryFile(buffer);
              console.log(` -> Writing ${sanitizedPath} with size ${buffer.byteLength} bytes`);
              // propagate to zenfs
              zenFs.writeFileSync(sanitizedPath, buffer);
              // update editor state
              const { current, parts, editorFiles } = traversePath(sanitizedPath);
              if (!current || !parts || !editorFiles || parts.length === 0) {
                console.error("[x] error writing file, could not traverse path", sanitizedPath);
                break;
              }
              const lastPart = parts[parts.length - 1];
              if (lastPart) {
                current.directory[lastPart] = {
                  file: {
                    size: buffer.byteLength,
                    isBinary
                  }
                };
              }
              useFileSystem.getState().setFiles(editorFiles);
              
              // Notify any listeners (Monaco editors) that this file has changed
              if (isChange) {
                notifyFileChange(sanitizedPath, buffer);
              }

              break;
            }
            case "remove_file": {
              console.log(` -> Removing ${sanitizedPath}`);
              
              zenFs.unlinkSync(sanitizedPath);
              
              const { current, parts, editorFiles } = traversePath(sanitizedPath);
              if (!current || !parts || !editorFiles || parts.length === 0) {
                console.error("[x] error removing file, could not traverse path", sanitizedPath);
                break;
              }
              const lastPart = parts[parts.length - 1];
              if (lastPart) {
                delete current.directory[lastPart];
              }
              useFileSystem.getState().setFiles(editorFiles);
              useEditorState.getState().removeTabWithPath(sanitizedPath, -1);
              break;
            }
            case "update_directory": {
              break;
            }
          }
        }
      })
    )
  }

  canOpenFile(path: string, allowBinary: boolean = false) {
    const exists = zenFs.existsSync(path)
    if (!exists) {
      return false;
    }
    const file = zenFs.readFileSync(path);
    if (!allowBinary && isBinaryFile(file)) {
      return false;
    }
    return true;
  }
  getEditableFileContent(path: string, force: boolean = false) {
    const exists = zenFs.existsSync(path)
    if (!exists) {
      return false;
    }
    const stats = zenFs.statSync(path);
    if (!stats.isFile()) {
      return false;
    }
    // check if file is binary
    const file = zenFs.readFileSync(path);
    if (force || !isBinaryFile(file)) {
      // if the file is empty, return an empty string
      if (file.byteLength === 0) {
        return "";
      }
      return file.toString('utf-8');
    }
    return null;
  }
  async writeFileAsync(path: string, content: string) {
    const container = getWebContainer();
    if (!container || container.status !== 'ready') {
      console.error(" -> container not ready, cannot write file", path);
      return;
    }
    console.log(" -> writing file", path, content);
    await Promise.all([
      // sync to webcontainer
      zenFs.writeFile(path, content),
      // sync to zenfs
      container.webContainer?.fs.writeFile(path, content)
    ]);
  }
}
export const fileSystem = new ZenFileSystemHandler();

function isBinaryFile(buffer: Uint8Array | undefined) {
  if (buffer === undefined) {
    return false;
  }

  return getEncoding(convertToBuffer(buffer), { chunkLength: 100 }) === 'binary';
}
function convertToBuffer(view: Uint8Array): Buffer {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}
// function decodeFileContent(buffer?: Uint8Array) {
//   if (!buffer || buffer.byteLength === 0) {
//     return '';
//   }

//   try {
//     return utf8TextDecoder.decode(buffer);
//   } catch (error) {
//     console.log(error);
//     return '';
//   }
// }
