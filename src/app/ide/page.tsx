"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("@/ide/app"), { ssr: false });
export default function IDEPage() {
	return <App />;
}