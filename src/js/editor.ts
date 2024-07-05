import { MarkdownEditor } from "./editor_core"

declare global {
    interface Window {
        MarkdownEditor: typeof MarkdownEditor
    }
}

window.MarkdownEditor = MarkdownEditor
