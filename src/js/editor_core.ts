import { minimalSetup } from "codemirror";
import { EditorView, placeholder, Decoration, keymap, KeyBinding, DOMEventHandlers } from '@codemirror/view';
import { EditorState, Compartment, RangeSet, RangeSetBuilder, RangeValue, StateField, Prec, Extension } from "@codemirror/state"
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxTree, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { insertNewlineAndIndent } from '@codemirror/commands';
import { Strikethrough, Autolink } from '@lezer/markdown';
import { Tag, tags } from "@lezer/highlight"
import { SyntaxNodeRef } from "@lezer/common"

const codeBlockMarker: Decoration = Decoration.line({ class: "cm-codeblock" });
const codeBlockMarkerInline: Decoration = Decoration.mark({ class: "cm-codeblock" })
const blockQuoteMarker: Decoration = Decoration.line({ class: "cm-blockquote" })
const url: Decoration = Decoration.mark({ class: "cm-url" })
const linkRegex: RegExp = /((?:(?:www\.)|(?:https?:\/\/))[\w-]+(?:\.[\w-]+)+(?:\/[^)\s<]*)*)|((mailto: {0,1})([\w.+-]+@[\w-]+(?:\.[\w.-]+)+))/gy;

function processNode(state: EditorState, node: SyntaxNodeRef, builder: RangeSetBuilder<RangeValue>) {
    if (node.type.is("FencedCode")) {
        var firstLine = state.doc.lineAt(node.from).number;
        var lastLine = state.doc.lineAt(node.to).number;
        for (let i = firstLine; i <= lastLine; i++) {
            builder.add(
                state.doc.line(i).from,
                state.doc.line(i).from,
                codeBlockMarker
            );
        }
    } else if (node.type.is("InlineCode")) {
        builder.add(node.from, node.to, codeBlockMarkerInline)
    } else if (node.type.is("Blockquote")) {
        var firstLine = state.doc.lineAt(node.from).number;
        var lastLine = state.doc.lineAt(node.to).number;
        for (let i = firstLine; i <= lastLine; i++) {
            builder.add(
                state.doc.line(i).from,
                state.doc.line(i).from,
                blockQuoteMarker
            );
        }
    }
}

function processURL(state: EditorState, node: SyntaxNodeRef, builder: RangeSetBuilder<RangeValue>) {
    if (node.type.is("URL")) {
        if (state.sliceDoc(node.from, node.to).match(linkRegex)) {
            builder.add(node.from, node.to, url)
        }
    }
}

const NodeProcessor = (node_processors: ((state: EditorState, node: SyntaxNodeRef, builder: RangeSetBuilder<RangeValue>) => void)[]) => StateField.define({
    create(state: EditorState) {
        const builder = new RangeSetBuilder();
        syntaxTree(state).iterate({
            enter(node) {
                node.type
                for (var processor of node_processors) {
                    processor(state, node, builder)
                }
            },
        });
        return builder.finish();
    },
    update(decorations, tr) {
        const builder = new RangeSetBuilder();
        decorations = decorations.map(tr.changes);
        syntaxTree(tr.state).iterate({
            enter(node) {
                for (var processor of node_processors) {
                    processor(tr.state, node, builder)
                }
            },
        });
        decorations = RangeSet.join([builder.finish()]);
        return decorations;
    },
    provide(field) {
        return EditorView.decorations.from(field as any);
    },
});

const ignored: (Tag | ((tag: Tag) => Tag))[] = [
    tags.comment,
    tags.name,
    tags.variableName,
    tags.tagName,
    tags.attributeName,
    tags.character,
    tags.attributeValue,
    tags.number,
    tags.integer,
    tags.float,
    tags.escape,
    tags.color,
    tags.self,
    tags.null,
    tags.unit,
    tags.modifier,
    tags.operatorKeyword,
    tags.controlKeyword,
    tags.definitionKeyword,
    tags.moduleKeyword,
    tags.operator,
    tags.derefOperator,
    tags.arithmeticOperator,
    tags.logicOperator,
    tags.bitwiseOperator,
    tags.compareOperator,
    tags.updateOperator,
    tags.definitionOperator,
    tags.typeOperator,
    tags.controlOperator,
    tags.punctuation,
    tags.separator,
    tags.bracket,
    tags.angleBracket,
    tags.squareBracket,
    tags.paren,
    tags.brace,
    tags.content,
    tags.quote,
    tags.monospace,
    tags.changed,
    tags.documentMeta,
    tags.annotation,
    tags.processingInstruction,
    tags.definition,
    tags.constant,
    tags.function,
    tags.standard,
    tags.local,
    tags.special
];

const prismMap = (tag: string, value: Tag | ((tag: Tag) => Tag)) => {
    let direct: string | undefined
    switch (tag) {
        case "className":
            direct = "class-name"
            break;
        case "bool":
            direct = "boolean"
            break;
        case "number": case "integer": case "float": case "atom": case "unit": case "modifier":
            direct = "number"
            break;
        case "string": case "literal":
            direct = "string"
            break;
        case "character":
            direct = "char"
            break;
        case "regexp":
            direct = "regex"
            break;
        case "constant":
            direct = "constant"
            break;
        case "function":
            direct = "function"
            break;
        case "special": case "annotation": case "escape":
            direct = "important"
            break;
        case "standard":
            direct = "builtin"
            break;
        case "punctuation": case "separator": case "bracket": case "angleBracket":
        case "squareBracket": case "paren": case "brace":
            direct = "punctuation"
            break;
        case "self": case "null":
            direct = "keyword"
            break;
        case "propertyName":
            direct = "property"
            break;
        case "variableName":
            direct = "variable"
            break;
        case "namespace":
            direct = "namespace"
            break;
        case "meta":
            direct = "meta"
            break;
        case "labelName":
            direct = "label"
            break;
    }
    if (!direct) {
        if (tag.toLowerCase().includes("comment")) {
            direct = "comment"
        } else if (tag.toLowerCase().includes("operator")) {
            direct = "operator"
        } else if (tag.toLowerCase().includes("keyword")) {
            direct = "keyword"
        }
    }
    if (direct) {
        return `token ${direct}`
    } else if (!ignored.includes(value)) {
        return `cm-${tag}`
    }
};

const ChatEditorKeys = (onenter: () => void) => [
    {
        key: "Enter", run: () => {
            onenter();
            return true
        }
    },
    { key: "Shift-Enter", run: insertNewlineAndIndent }
]

class MarkdownEditor {
    static CodeMirrorTags: {
        [key: string]: Tag | ((tag: Tag) => Tag);
    };
    static ChatEditorKeys: any;
    static PrismMap: (tag: string, value: Tag | ((tag: Tag) => Tag)) => string | undefined;

    placeholderHolder: Compartment;
    editable: Compartment;
    eventListener: any;
    codemirror: EditorView;

    /**
     * Create a new markdown editor
     * @param {*} textarea The text area to attach to. It will be added to the parents div
     * @param {*} options Various option to pass onto
     *                    - placeholder: Define a placeholder text when the editor is empty
     *                    - extensions: Codemirror extensions to add to
     *                    - keys: Custom keybindings to use
     *                    - listeners: Listeners for dom events
     *                    - maxLength: Max character length
     *                    - editable: If the editor can be edited
     *                    - highlightmap: A function that should map a tag to its css class
     *                    - only_autolink: Only show AutoLink. Things like [title](link) will only highlight link
     */
    constructor(textarea: HTMLElement,
        options: { placeholder?: string; 
            extensions?: Extension[]; 
            keys?: KeyBinding[]; 
            listeners?: DOMEventHandlers<any>; 
            maxLength?: number; 
            only_autolink?: boolean; 
            highlightmap?: (tag: string, value: Tag | ((tag: Tag) => Tag)) => string | undefined; 
            editable?: boolean; 
        }) {
        if (!options) {
            options = {};
        }
        var placeholderTxt = options.placeholder || "...";
        var customExtensions = options.extensions || [];
        this.placeholderHolder = new Compartment();
        this.editable = new Compartment();

        let updateListenerExtension = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                for (var listener of this.eventListener.input) {
                    listener({ element: this.codemirror.dom, codemirror: this.codemirror, value: this.value() })
                }
            }
            if (update.focusChanged || update.selectionSet) {
                for (var listener of this.eventListener.selection) {
                    listener({ element: this.codemirror.dom, codemirror: this.codemirror, selection: update.state.selection })
                }
            }
        });

        let key = Prec.highest(
            keymap.of(options.keys || [])
        );

        let domhandlers = EditorView.domEventHandlers(options.listeners || {});

        let filter = (tr: { newDoc: string | any[]; }) => !options.maxLength || tr.newDoc.length <= options.maxLength;

        let highlights = Object.entries(tags).map(([key, value]) => {
            var clss: string | undefined = " "
            // Disable link marks
            if (options.only_autolink && (value === tags.link || value === tags.url)) {
                return { tag: value, class: " " };
            }
            if (options.highlightmap) {
                clss = options.highlightmap(key, value)
            } else if (!ignored.includes(value)) {
                clss = `cm-${key}`
            }
            return { tag: value, class: `${clss}` }
        }).filter(e => e !== undefined);

        this.codemirror = new EditorView({
            extensions: [
                minimalSetup,
                markdown({
                    codeLanguages: languages,
                    extensions: [Strikethrough, Autolink],
                    completeHTMLTags: false,
                }),
                NodeProcessor(options.only_autolink ? [processNode, processURL] : [processNode]),
                syntaxHighlighting(HighlightStyle.define(highlights as any)),
                this.placeholderHolder.of(placeholder(placeholderTxt)),
                this.editable.of(EditorView.editable.of(options.editable === undefined || options.editable)),
                updateListenerExtension,
                key,
                domhandlers,
                EditorState.changeFilter.of(filter as any),
                customExtensions,
            ],
        });

        var element = textarea.parentNode || textarea;
        if (textarea !== document.body) {
            element.insertBefore(this.codemirror.dom, textarea)
            textarea.style.display = "none"
        } else {
            element.append(this.codemirror.dom)
        }
        this.eventListener = {
            input: [],
            selection: []
        };
        (textarea as any).markdownEditor = this;
    }

    /**
     * Update the current placeholder text
     */
    updatePlaceholder(val: string | HTMLElement) {
        this.codemirror.dispatch({
            effects: this.placeholderHolder.reconfigure(placeholder(val))
        })
    }

    /**
     * Set the editor as read only
     */
    setEditable(val: boolean) {
        this.codemirror.dispatch({
            effects: this.editable.reconfigure(EditorView.editable.of(val))
        })
    }

    /**
     * Get or set the current value
     */
    value(val?: string) {
        if (val === undefined) {
            return this.codemirror.state.doc.toString();
        } else {
            this.codemirror.dispatch({
                changes: { from: 0, to: this.codemirror.state.doc.length, insert: val }
            })
            return this;
        }
    }

    /**
     * Register an event listener to this editor
     * @param {*} type Supported are: 
     *                - "input": Called whenever the text changes in the dom. Parameters: {element, codemirror, value}
     *                - "selection": Called whenever the selection in the dom changes. Parameters: {element, codemirror, selection}
     * @param {*} handler Event handler
     */
    registerListener(type: 'input' | 'selection', handler: any) {
        this.eventListener[type].push(handler);
    }
}

MarkdownEditor.CodeMirrorTags = tags;
MarkdownEditor.ChatEditorKeys = ChatEditorKeys;
MarkdownEditor.PrismMap = prismMap;

export { MarkdownEditor }
