import React, { useState, useCallback, useMemo, useEffect, FC } from "react";
import { Editable, withReact, Slate } from "slate-react";
import { createEditor, Node } from "slate";
import "./RichEditor.css";

export const getTextFromNodes = (nodes: Node[]) => {
  return nodes.map((n: Node) => Node.string(n)).join("\n");
};

const initialValue = [
  {
    type: "paragraph",
    children: [{ text: "" }],
  },
];

class RichEditorProps {
  existingBody?: string;
  readOnly?: boolean;
  sendOutBody?: (body: Node[]) => void;
}

const RichEditor: FC<RichEditorProps> = ({
  existingBody,
  readOnly,
  sendOutBody,
}) => {
  const [value, setValue] = useState<Node[]>(initialValue as any);
  
  // FIX: Use a simpler editor without history (undo/redo) to improve Android IME stability
  const editor = useMemo(() => withReact(createEditor()), []);
  editor.children = value;

  const renderElement = useCallback((props: any) => <Element {...props} />, []);
  const renderLeaf = useCallback((props: any) => <Leaf {...props} />, []);

  useEffect(() => {
    if (existingBody) {
      try {
        const parsed = JSON.parse(existingBody);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setValue(parsed);
        }
      } catch (error) {
        // Fallback if it's plain text instead of JSON
        setValue([{ type: "paragraph", children: [{ text: existingBody }] }] as any);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingBody]);

  const onChangeEditorValue = (val: Node[]) => {
    setValue(val);
    sendOutBody && sendOutBody(val);
  };

  return (
    // FIX: Slate expects 'initialValue' instead of 'value' in this version
    <Slate editor={editor} initialValue={value} onChange={onChangeEditorValue}>
      <Editable
        className="editor"
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        placeholder="Enter your question here."
        spellCheck
        readOnly={readOnly}
      />
    </Slate>
  );
};

// We keep these renderers so that OLD messages that contain bold/italic/quotes 
// will still display correctly, even though the user can no longer create them.
const Element = ({ attributes, children, element }: { attributes: any; children: any; element: any }) => {
  switch (element.type) {
    case "block-quote":
      return <blockquote {...attributes}>{children}</blockquote>;
    case "bulleted-list":
      return <ul {...attributes}>{children}</ul>;
    case "heading-one":
      return <h1 {...attributes}>{children}</h1>;
    case "heading-two":
      return <h2 {...attributes}>{children}</h2>;
    case "list-item":
      return <li {...attributes}>{children}</li>;
    case "numbered-list":
      return <ol {...attributes}>{children}</ol>;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

const Leaf = ({ attributes, children, leaf }: { attributes: any; children: any; leaf: any }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }
  if (leaf.code) {
    children = <code>{children}</code>;
  }
  if (leaf.italic) {
    children = <em>{children}</em>;
  }
  if (leaf.underline) {
    children = <u>{children}</u>;
  }
  return <span {...attributes}>{children}</span>;
};

export default RichEditor;

// import React, { useState, useCallback, useMemo, useEffect, FC } from "react";
// import { Editable, withReact, useSlate, Slate } from "slate-react";
// import { Editor, Transforms, createEditor, Node, Element as SlateElement} from "slate";
// import isHotkey from "is-hotkey";
// import { withHistory } from "slate-history";
// import { Button, Toolbar } from "./RichTextControls";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import {
//   faBold,
//   faItalic,
//   faUnderline,
//   faCode,
//   faHeading,
//   faQuoteRight,
//   faListOl,
//   faListUl,
// } from "@fortawesome/free-solid-svg-icons";
// import "./RichEditor.css";

// // TypeScript users only add this code
// // import { BaseEditor, Descendant } from 'slate'
// // import { ReactEditor } from 'slate-react'


// export const getTextFromNodes = (nodes: Node[]) => {
//   return nodes.map((n: Node) => Node.string(n)).join("\n");
// };


// // type CustomElement = { type: 'paragraph'; children: Descendant[] }
// // type CustomText = { text: string}

// // declare module 'slate' {
// //   interface CustomTypes {
// //     Editor: BaseEditor & ReactEditor
// //     Element: CustomElement
// //     Text: CustomText
// //   }
// // }

// const HOTKEYS: { [keyName: string]: string } = {
//   "mod+b": "bold",
//   "mod+i": "italic",
//   "mod+u": "underline",
//   "mod+`": "code",
// };
// // const initialValue: Descendant[] = [
// //   {
// //     type: "paragraph",
// //     children: [{ text: "Please type something" }],
// //   },
// // ];



// const initialValue = [
//   {
//     type: "paragraph",
//     children: [{ text: "" }],
//   },
// ];

// // const initialValue: Descendant[] = [
// //   {
// //     type: 'paragraph',
// //     children: [{ text: 'A line of text in a paragraph.' }],
// //   },
// // ]

// const LIST_TYPES = ["numbered-list", "bulleted-list"];



// class RichEditorProps {
//   existingBody?: string;
//   readOnly?: boolean;
//   sendOutBody?: (body: Node[]) => void;
// }

// // const text:  RichEditorProps = {
// //   existingBody: "text",
// //   readOnly: false,
// //   sendOutBody?: (body: Node[]) => void
// // };

// // interface User {
// //     name: string;
// //     age: number;
// // }

// // const user: User = {
// //     name: "John", // Assigning a value when creating the object
// //     age: 30
// // };


// const RichEditor: FC<RichEditorProps> = ({ 
//   existingBody, 
//   readOnly,
//   sendOutBody,
// }) => {
//   const [value, setValue] = useState<Node[]>(initialValue);
//   const renderElement = useCallback((props: any ) => <Element {...props} />, []);
//   const renderLeaf = useCallback((props: any ) => <Leaf {...props} />, []);
//   const editor = useMemo(() => withHistory(withReact(createEditor())), []);
//   editor.children = value

//   useEffect(() => {
//   console.log("existingBody", existingBody);
//   if (existingBody) {
//       setValue(JSON.parse(existingBody))
//     // setValue(parsebody)
//     //         try {
//     //         const parsedBody = JSON.parse(existingBody);
//     //         console.log("Parsed Body:", parsedBody);
//     //         if (Array.isArray(parsedBody)) {
//     //             setValue(parsedBody);
//     //         } else {
//     //             console.error("Parsed body is not an array:", parsedBody);
//     //         }
//     //     } catch (error) {
//     //         console.error("Error parsing existingBody:", error);
//     //     }
//     // }
//   }
//   // eslint-disable-next-line react-hooks/exhaustive-deps
// }, [existingBody]);

//   // useEffect(() => {
//   //   if (existingBody) {
//   //     setValue([
//   //       {
//   //         type: "paragraph",
//   //         text: existingBody,
//   //       },
//   //     ]);
//   //   }
//   // }, []);
// // useEffect(() => {
// //         console.log("Current Value:", value);
// //     }, [value]);


//   const onChangeEditorValue = (val: Node[]) => {    
//     setValue(val);
//     console.log("Current editor value:", val); // Debugging log
//     sendOutBody && sendOutBody(val);
//   };

//   return (
//     <Slate editor={editor} initialValue={value} onChange={onChangeEditorValue}>  
//       {readOnly ? null : (
//         <Toolbar>
//           <MarkButton format="bold" icon="bold" />
//           <MarkButton format="italic" icon="italic" />
//           <MarkButton format="underline" icon="underlined" />
//           <MarkButton format="code" icon="code" />
//           <BlockButton format="heading-one" icon="header1" />
//           <BlockButton format="block-quote" icon="in_quotes" />
//           <BlockButton format="numbered-list" icon="list_numbered" />
//           <BlockButton format="bulleted-list" icon="list_bulleted" />
//         </Toolbar>
//       )}
//       <Editable
//         className="editor"
//         renderElement={renderElement}
//         renderLeaf={renderLeaf}
//         placeholder="Enter your question here."
//         spellCheck
//         // autoFocus
//         onKeyDown={(event) => {
//           for (const hotkey in HOTKEYS) {
//             if (isHotkey(hotkey, event as any)) {
//               event.preventDefault();
//               const mark = HOTKEYS[hotkey];
//               toggleMark(editor, mark);
//             }
//           }
//         }}
//         readOnly={readOnly}
//       />
//     </Slate>
//   );
// };

// const MarkButton = ({ format, icon }: { format: string; icon: string }) => {
//   const editor = useSlate();
//   let thisIcon = faBold;
//   if (icon === "italic") {
//     thisIcon = faItalic;
//   } else if (icon === "underlined") {
//     thisIcon = faUnderline;
//   } else if (icon === "code") {
//     thisIcon = faCode;
//   }
//   return (
//     <Button
//       active={isMarkActive(editor, format)}
//       onMouseDown={(event: any) => {
//         event.preventDefault();
//         toggleMark(editor, format);
//       }}
//     >
//       <FontAwesomeIcon icon={thisIcon} />
//     </Button>
//   );
// };

// const isMarkActive = (editor: Editor, format: string) => {
//   const marks = Editor.marks(editor);
//   return marks ? marks === true : false;
// };

// const toggleMark = (editor: Editor, format: string) => {
//   const isActive = isMarkActive(editor, format);

//   if (isActive) {
//     Editor.removeMark(editor, format);
//   } else {
//     Editor.addMark(editor, format, true);
//   }
// };

// const BlockButton = ({ format, icon }: { format: any ; icon: string }) => {
//   const editor = useSlate();
//   let thisIcon = faHeading;
//   if (icon === "heading1") {
//     thisIcon = faItalic;
//   } else if (icon === "heading2") {
//     thisIcon = faUnderline;
//   } else if (icon === "in_quotes") {
//     thisIcon = faQuoteRight;
//   } else if (icon === "list_numbered") {
//     thisIcon = faListOl;
//   } else if (icon === "list_bulleted") {
//     thisIcon = faListUl;
//   }
//   return (
//     <Button
//       active={isBlockActive(editor, format)}
//       onMouseDown={(event: any) => {
//         event.preventDefault();
//         toggleBlock(editor, format);
//       }}
//     >
//       <FontAwesomeIcon icon={thisIcon} />
//     </Button>
//   );
// };

// const isBlockActive = (editor: Editor, format: string) => {
//   return false; // Always return false or a default value
// };

// const toggleBlock = (editor: Editor, format: any) => {
//   // Do nothing for now
// };

// // const isBlockActive = (editor: Editor, format: string) => {
// //   const [match] = Array.from(
// //     Editor.nodes(editor, {
// //     match: (n) => SlateElement.isElement(n) && n.type === format,
// //   }));

// //   return !!match;
// // };

// // const toggleBlock = (editor: Editor, format: any) => {
// //   const isActive = isBlockActive(editor, format);
// //   const isList = LIST_TYPES.includes(format);


// //   Transforms.unwrapNodes(editor, {
// //     match: (n: Node) =>
// //       LIST_TYPES.includes(
// //         (!Editor.isEditor(n) && SlateElement.isElement(n) && n.type) as string
// //       ),
// //     split: true,
// //   });
// //   // Transforms.unwrapNodes(editor, {
// //   //   match: (n) =>
// //   //   LIST_TYPES.includes(n.type as string),
// //   //   split: true,
// //   // });

// //   Transforms.setNodes(editor, {
// //     type: isActive ? "paragraph" : isList ? "list-item" : format,
// //   });

// //   if (!isActive && isList) {
// //     const block = { type: format, children: [] };
// //     Transforms.wrapNodes(editor, block);
// //   }
// // };

// const Element = ({
//   attributes,
//   children,
//   element,
// }: 
// { 
//   attributes: any;
//   children: any;
//   element: any;
// }
// ) => {
//   switch (element.type) {
//     case "block-quote":
//       return <blockquote {...attributes}>{children}</blockquote>;
//     case "bulleted-list":
//       return <ul {...attributes}>{children}</ul>;
//     case "heading-one":
//       return <h1 {...attributes}>{children}</h1>;
//     case "heading-two":
//       return <h2 {...attributes}>{children}</h2>;
//     case "list-item":
//       return <li {...attributes}>{children}</li>;
//     case "numbered-list":
//       return <ol {...attributes}>{children}</ol>;
//     default:
//       return <p {...attributes}>{children}</p>;
//   }
// };

// const Leaf = ({
//   attributes,
//   children,
//   leaf,
// }: {
//   attributes: any;
//   children: any;
//   leaf: any;
// }) => {
//   if (leaf.bold) {
//     children = <strong>{children}</strong>;
//   }
//   if (leaf.code) {
//     children = <code>{children}</code>;
//   }
//   if (leaf.italic) {
//     children = <em>{children}</em>;
//   }
//   if (leaf.underline) {
//     children = <u>{children}</u>;
//   }

//   return <span {...attributes}>{children}</span>;
// };

// export default RichEditor;


// import React, { useState, useCallback, useMemo, useEffect, FC } from "react";
// import { Editable, withReact, useSlate, Slate } from "slate-react";
// import { Editor, Transforms, createEditor, Node, Element as SlateElement} from "slate";
// import isHotkey from "is-hotkey";
// import { withHistory } from "slate-history";
// import { Button, Toolbar } from "./RichTextControls";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// import {
//   faBold,
//   faItalic,
//   faUnderline,
//   faCode,
//   faHeading,
//   faQuoteRight,
//   faListOl,
//   faListUl,
// } from "@fortawesome/free-solid-svg-icons";
// import "./RichEditor.css";

// // TypeScript users only add this code
// // import { BaseEditor, Descendant } from 'slate'
// // import { ReactEditor } from 'slate-react'


// export const getTextFromNodes = (nodes: Node[]) => {
//   return nodes.map((n: Node) => Node.string(n)).join("\n");
// };


// // type CustomElement = { type: 'paragraph'; children: Descendant[] }
// // type CustomText = { text: string}

// // declare module 'slate' {
// //   interface CustomTypes {
// //     Editor: BaseEditor & ReactEditor
// //     Element: CustomElement
// //     Text: CustomText
// //   }
// // }

// const HOTKEYS: { [keyName: string]: string } = {
//   "mod+b": "bold",
//   "mod+i": "italic",
//   "mod+u": "underline",
//   "mod+`": "code",
// };
// // const initialValue: Descendant[] = [
// //   {
// //     type: "paragraph",
// //     children: [{ text: "Please type something" }],
// //   },
// // ];



// const initialValue = [
//   {
//     type: "paragraph",
//     children: [{ text: "" }],
//   },
// ];

// // const initialValue: Descendant[] = [
// //   {
// //     type: 'paragraph',
// //     children: [{ text: 'A line of text in a paragraph.' }],
// //   },
// // ]

// const LIST_TYPES = ["numbered-list", "bulleted-list"];



// class RichEditorProps {
//   existingBody?: string;
//   readOnly?: boolean;
//   sendOutBody?: (body: Node[]) => void;
// }

// // const text:  RichEditorProps = {
// //   existingBody: "text",
// //   readOnly: false,
// //   sendOutBody?: (body: Node[]) => void
// // };

// // interface User {
// //     name: string;
// //     age: number;
// // }

// // const user: User = {
// //     name: "John", // Assigning a value when creating the object
// //     age: 30
// // };


// const RichEditor: FC<RichEditorProps> = ({ 
//   existingBody, 
//   readOnly,
//   sendOutBody,
// }) => {
//   const [value, setValue] = useState<Node[]>(initialValue);
//   const renderElement = useCallback((props: any ) => <Element {...props} />, []);
//   const renderLeaf = useCallback((props: any ) => <Leaf {...props} />, []);
//   const editor = useMemo(() => withHistory(withReact(createEditor())), []);
//   editor.children = value

//   useEffect(() => {
//   console.log("existingBody", existingBody);
//   if (existingBody) {
//       setValue(JSON.parse(existingBody))
//     // setValue(parsebody)
//     //         try {
//     //         const parsedBody = JSON.parse(existingBody);
//     //         console.log("Parsed Body:", parsedBody);
//     //         if (Array.isArray(parsedBody)) {
//     //             setValue(parsedBody);
//     //         } else {
//     //             console.error("Parsed body is not an array:", parsedBody);
//     //         }
//     //     } catch (error) {
//     //         console.error("Error parsing existingBody:", error);
//     //     }
//     // }
//   }
//   // eslint-disable-next-line react-hooks/exhaustive-deps
// }, [existingBody]);

//   // useEffect(() => {
//   //   if (existingBody) {
//   //     setValue([
//   //       {
//   //         type: "paragraph",
//   //         text: existingBody,
//   //       },
//   //     ]);
//   //   }
//   // }, []);
// // useEffect(() => {
// //         console.log("Current Value:", value);
// //     }, [value]);


//   const onChangeEditorValue = (val: Node[]) => {    
//     setValue(val);
//     console.log("Current editor value:", val); // Debugging log
//     sendOutBody && sendOutBody(val);
//   };

//   return (
//     <Slate editor={editor} initialValue={value} onChange={onChangeEditorValue}>  
//       {readOnly ? null : (
//         <Toolbar>
//           <MarkButton format="bold" icon="bold" />
//           <MarkButton format="italic" icon="italic" />
//           <MarkButton format="underline" icon="underlined" />
//           <MarkButton format="code" icon="code" />
//           <BlockButton format="heading-one" icon="header1" />
//           <BlockButton format="block-quote" icon="in_quotes" />
//           <BlockButton format="numbered-list" icon="list_numbered" />
//           <BlockButton format="bulleted-list" icon="list_bulleted" />
//         </Toolbar>
//       )}
//       <Editable
//         className="editor"
//         renderElement={renderElement}
//         renderLeaf={renderLeaf}
//         placeholder="Enter your question here."
//         spellCheck
//         autoFocus
//         onKeyDown={(event) => {
//           for (const hotkey in HOTKEYS) {
//             if (isHotkey(hotkey, event as any)) {
//               event.preventDefault();
//               const mark = HOTKEYS[hotkey];
//               toggleMark(editor, mark);
//             }
//           }
//         }}
//         readOnly={readOnly}
//       />
//     </Slate>
//   );
// };

// const MarkButton = ({ format, icon }: { format: string; icon: string }) => {
//   const editor = useSlate();
//   let thisIcon = faBold;
//   if (icon === "italic") {
//     thisIcon = faItalic;
//   } else if (icon === "underlined") {
//     thisIcon = faUnderline;
//   } else if (icon === "code") {
//     thisIcon = faCode;
//   }
//   return (
//     <Button
//       active={isMarkActive(editor, format)}
//       onMouseDown={(event: any) => {
//         event.preventDefault();
//         toggleMark(editor, format);
//       }}
//     >
//       <FontAwesomeIcon icon={thisIcon} />
//     </Button>
//   );
// };

// const isMarkActive = (editor: Editor, format: string) => {
//   const marks = Editor.marks(editor);
//   return marks ? marks === true : false;
// };

// const toggleMark = (editor: Editor, format: string) => {
//   const isActive = isMarkActive(editor, format);

//   if (isActive) {
//     Editor.removeMark(editor, format);
//   } else {
//     Editor.addMark(editor, format, true);
//   }
// };

// const BlockButton = ({ format, icon }: { format: any ; icon: string }) => {
//   const editor = useSlate();
//   let thisIcon = faHeading;
//   if (icon === "heading1") {
//     thisIcon = faItalic;
//   } else if (icon === "heading2") {
//     thisIcon = faUnderline;
//   } else if (icon === "in_quotes") {
//     thisIcon = faQuoteRight;
//   } else if (icon === "list_numbered") {
//     thisIcon = faListOl;
//   } else if (icon === "list_bulleted") {
//     thisIcon = faListUl;
//   }
//   return (
//     <Button
//       active={isBlockActive(editor, format)}
//       onMouseDown={(event: any) => {
//         event.preventDefault();
//         toggleBlock(editor, format);
//       }}
//     >
//       <FontAwesomeIcon icon={thisIcon} />
//     </Button>
//   );
// };


// const isBlockActive = (editor: Editor, format: string) => {
//   const [match] = Array.from(
//     Editor.nodes(editor, {
//     match: (n) => SlateElement.isElement(n) && n.type === format,
//   }));

//   return !!match;
// };

// const toggleBlock = (editor: Editor, format: any) => {
//   const isActive = isBlockActive(editor, format);
//   const isList = LIST_TYPES.includes(format);


//   Transforms.unwrapNodes(editor, {
//     match: (n: Node) =>
//       LIST_TYPES.includes(
//         (!Editor.isEditor(n) && SlateElement.isElement(n) && n.type) as string
//       ),
//     split: true,
//   });
//   // Transforms.unwrapNodes(editor, {
//   //   match: (n) =>
//   //   LIST_TYPES.includes(n.type as string),
//   //   split: true,
//   // });

//   Transforms.setNodes(editor, {
//     type: isActive ? "paragraph" : isList ? "list-item" : format,
//   });

//   if (!isActive && isList) {
//     const block = { type: format, children: [] };
//     Transforms.wrapNodes(editor, block);
//   }
// };

// const Element = ({
//   attributes,
//   children,
//   element,
// }: 
// { 
//   attributes: any;
//   children: any;
//   element: any;
// }
// ) => {
//   switch (element.type) {
//     case "block-quote":
//       return <blockquote {...attributes}>{children}</blockquote>;
//     case "bulleted-list":
//       return <ul {...attributes}>{children}</ul>;
//     case "heading-one":
//       return <h1 {...attributes}>{children}</h1>;
//     case "heading-two":
//       return <h2 {...attributes}>{children}</h2>;
//     case "list-item":
//       return <li {...attributes}>{children}</li>;
//     case "numbered-list":
//       return <ol {...attributes}>{children}</ol>;
//     default:
//       return <p {...attributes}>{children}</p>;
//   }
// };

// const Leaf = ({
//   attributes,
//   children,
//   leaf,
// }: {
//   attributes: any;
//   children: any;
//   leaf: any;
// }) => {
//   if (leaf.bold) {
//     children = <strong>{children}</strong>;
//   }
//   if (leaf.code) {
//     children = <code>{children}</code>;
//   }
//   if (leaf.italic) {
//     children = <em>{children}</em>;
//   }
//   if (leaf.underline) {
//     children = <u>{children}</u>;
//   }

//   return <span {...attributes}>{children}</span>;
// };

// export default RichEditor;