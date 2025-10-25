"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@/ide/monaco/editor"), { 
	ssr: false 
});

export default function IDEPage() {
	return <MonacoEditor />;
}