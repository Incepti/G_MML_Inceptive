"use client";

import React, { useEffect, useRef, useCallback } from "react";
import Editor, { useMonaco, Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface MonacoEditorProps {
  value: string;
  language: "html" | "javascript";
  onChange: (value: string) => void;
  errors?: Array<{ line?: number; column?: number; message: string }>;
  readOnly?: boolean;
}

// ─── All 13 supported MML Alpha tags (ODK MML Docs Feb 2026) ──────────────
const MML_SNIPPETS: Array<{
  label: string;
  insertText: string;
  documentation: string;
}> = [
  {
    label: "m-cube",
    insertText: '<m-cube color="${1:#888888}" width="${2:1}" height="${3:1}" depth="${4:1}" x="${5:0}" y="${6:1}" z="${7:0}" cast-shadows="${8:true}"></m-cube>',
    documentation: "Box primitive. Material: color, opacity, metalness, roughness, emissive, emissive-intensity, src (texture)",
  },
  {
    label: "m-sphere",
    insertText: '<m-sphere radius="${1:1}" color="${2:#888888}" x="${3:0}" y="${4:1}" z="${5:0}"></m-sphere>',
    documentation: "Sphere primitive. Supports all material attributes.",
  },
  {
    label: "m-cylinder",
    insertText: '<m-cylinder radius="${1:0.5}" height="${2:2}" color="${3:#888888}" x="${4:0}" y="${5:1}" z="${6:0}"></m-cylinder>',
    documentation: "Cylinder primitive (radius, height). Supports all material attributes.",
  },
  {
    label: "m-plane",
    insertText: '<m-plane width="${1:10}" height="${2:10}" color="${3:#888888}" receive-shadows="${4:true}"></m-plane>',
    documentation: "Flat plane. Horizontal by default. rx=-90 makes vertical wall.",
  },
  {
    label: "m-model",
    insertText: '<m-model src="${1:https://...}" x="${2:0}" y="${3:0}" z="${4:0}" cast-shadows="${5:true}"></m-model>',
    documentation: "GLTF/GLB 3D model. src= MUST be a verified direct .glb URL — never fabricated.",
  },
  {
    label: "m-character",
    insertText: '<m-character src="${1:https://...}" x="${2:0}" y="${3:0}" z="${4:0}"></m-character>',
    documentation: "Rigged character model with animations. src= MUST be a verified .glb URL.",
  },
  {
    label: "m-light",
    insertText: '<m-light type="${1|point,directional,spot|}" color="${2:#ffffff}" intensity="${3:1}" x="${4:0}" y="${5:5}" z="${6:0}"></m-light>',
    documentation: "Scene light. type= REQUIRED. Types: point, directional, spot. HARD CAP: 8 lights total.",
  },
  {
    label: "m-image",
    insertText: '<m-image src="${1:https://...}" width="${2:2}" height="${3:2}" x="${4:0}" y="${5:1}" z="${6:0}"></m-image>',
    documentation: "Image quad. src= must be a validated URL.",
  },
  {
    label: "m-video",
    insertText: '<m-video src="${1:https://...}" width="${2:4}" height="${3:2.25}" loop="${4:true}" autoplay="${5:true}" x="${6:0}" y="${7:1}" z="${8:0}"></m-video>',
    documentation: "Video quad. src= must be a validated URL.",
  },
  {
    label: "m-label",
    insertText: '<m-label content="${1:Hello World}" font-size="${2:24}" color="${3:#ffffff}" alignment="${4|center,left,right|}" x="${5:0}" y="${6:2}" z="${7:0}"></m-label>',
    documentation: "Floating 3D text label.",
  },
  {
    label: "m-prompt",
    insertText: '<m-prompt message="${1:Enter something:}" placeholder="${2:type here...}" x="${3:0}" y="${4:1}" z="${5:0}"></m-prompt>',
    documentation: "User text input. Fires 'prompt' event. Note: click events NOT supported in Unreal Alpha.",
  },
  {
    label: "m-group",
    insertText: '<m-group x="${1:0}" y="${2:0}" z="${3:0}">\n  $0\n</m-group>',
    documentation: "Transform group container. All children inherit transform.",
  },
  {
    label: "m-attr-anim",
    insertText: '<m-attr-anim attr="${1:ry}" start="${2:0}" end="${3:360}" duration="${4:5000}" loop="${5:true}" easing="${6|linear,easeIn,easeOut,easeInOut,easeInQuart,easeOutSine|}"></m-attr-anim>',
    documentation: "Declarative animation. MUST be a CHILD of the element it animates. attr= is REQUIRED.",
  },
];

// ─── JS dynamic MML snippets ───────────────────────────────────────────────
const JS_SNIPPETS: Array<{
  label: string;
  insertText: string;
  documentation: string;
}> = [
  {
    label: "mml-createElement",
    insertText: "const ${1:el} = document.createElement('${2:m-cube}');\n${1:el}.setAttribute('${3:color}', '${4:#ff0000}');\ndocument.body.appendChild(${1:el});",
    documentation: "Create and append an MML element (server-side virtual DOM)",
  },
  {
    label: "mml-game-loop",
    insertText: "let tick = 0;\nsetInterval(() => {\n  tick++;\n  // deterministic animation using tick\n  ${1:el}.setAttribute('ry', String((tick * 2) % 360));\n}, 33); // 33ms = ~30fps",
    documentation: "Standard MML game loop at 33ms (~30fps). Use tick for deterministic animation.",
  },
  {
    label: "mml-prompt-handler",
    insertText: "const prompt = document.createElement('m-prompt');\nprompt.setAttribute('message', '${1:Ask something:}');\nprompt.setAttribute('placeholder', '${2:type here...}');\nprompt.addEventListener('prompt', (e) => {\n  const text = e.detail.message;\n  console.log('User said:', text);\n});\ndocument.body.appendChild(prompt);",
    documentation: "m-prompt event handler for user text input",
  },
  {
    label: "mml-attr-anim-dynamic",
    insertText: "const anim = document.createElement('m-attr-anim');\nanim.setAttribute('attr', '${1:ry}');\nanim.setAttribute('start', '${2:0}');\nanim.setAttribute('end', '${3:360}');\nanim.setAttribute('duration', '${4:5000}');\nanim.setAttribute('loop', 'true');\nanim.setAttribute('easing', 'linear');\n${5:el}.appendChild(anim);",
    documentation: "Attach m-attr-anim as child of element to animate",
  },
  {
    label: "mml-fetch-api",
    insertText: "async function fetchData() {\n  try {\n    const res = await fetch('${1:https://api.example.com/data}');\n    return await res.json();\n  } catch (err) {\n    console.error('Fetch failed:', err);\n    return null;\n  }\n}\nsetInterval(async () => {\n  const data = await fetchData();\n  if (data) { /* update MML elements */ }\n}, ${2:30000});",
    documentation: "Fetch external API and update MML (Node 18+ fetch — allowed per Build System V2)",
  },
];

function registerMMLLanguage(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider("html", {
    triggerCharacters: ["<", " "],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: MML_SNIPPETS.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: s.documentation,
          detail: "MML Alpha Element",
          range,
        })),
      };
    },
  });

  monaco.languages.registerCompletionItemProvider("javascript", {
    triggerCharacters: [".", "d"],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: JS_SNIPPETS.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: s.documentation,
          detail: "MML Dynamic Pattern",
          range,
        })),
      };
    },
  });
}

export function MonacoEditorPanel({
  value,
  language,
  onChange,
  errors = [],
  readOnly = false,
}: MonacoEditorProps) {
  const monaco = useMonaco();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (monaco) registerMMLLanguage(monaco);
  }, [monaco]);

  useEffect(() => {
    if (!monaco || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const markers = errors
      .filter((e) => e.line)
      .map((e) => ({
        severity: monaco.MarkerSeverity.Error,
        message: e.message,
        startLineNumber: e.line!,
        startColumn: e.column || 1,
        endLineNumber: e.line!,
        endColumn: model.getLineLength(e.line!) + 1,
      }));
    monaco.editor.setModelMarkers(model, "mml-validator", markers);
  }, [errors, monaco]);

  const handleMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  return (
    <Editor
      height="100%"
      language={language === "html" ? "html" : "javascript"}
      value={value}
      onChange={(v) => onChange(v || "")}
      onMount={handleMount}
      theme="vs-dark"
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        lineNumbers: "on",
        glyphMargin: true,
        folding: true,
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        readOnly,
        bracketPairColorization: { enabled: true },
        formatOnPaste: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, comments: false, strings: false },
        padding: { top: 12, bottom: 12 },
      }}
    />
  );
}
