"use client";

import { MonacoEditorReactComp } from '@typefox/monaco-editor-react';
import { useEffect, useState } from 'react';
import { configure } from './config';
import { configurePostStart } from '@/ide/monaco/common';

const MonacoEditor = () => {
  const [config, setConfig] = useState<Awaited<ReturnType<typeof configure>> | null>(null);

  useEffect(() => {
    configure().then(setConfig);
  }, []);

  if (!config) {
    return <div>Loading editor...</div>;
  }

  return (
    <MonacoEditorReactComp
      vscodeApiConfig={config.vscodeApiConfig}
      onVscodeApiInitDone={async (apiWrapper) => {
        await configurePostStart(apiWrapper, config)
      }}
      onError={async (error) => {
        console.error(error);
      }}
    />
  )
}
export default MonacoEditor;