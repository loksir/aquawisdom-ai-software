import { css, cx } from '@emotion/css'
import React, { PropsWithChildren, ReactNode, Ref, ForwardRefExoticComponent, RefAttributes, ComponentPropsWithoutRef } from 'react'
import ReactDOM from 'react-dom'


interface BaseProps {
  className?: string;
  // Remove the index signature or make it more specific
  style?: React.CSSProperties;
  title?: string;
  // Add other specific props you need instead of [key: string]: unknown
}

// In RichTextControls.tsx
interface ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'active' | 'reversed'> {
  active: boolean;
  reversed?: boolean; // Make reversed optional
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, active, reversed = false, ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      className={cx(
        css`
          border: none;
          background: none;
          padding: 0;
          cursor: pointer;
          color: ${reversed
            ? active
              ? 'white'
              : '#aaa'
            : active
            ? 'black'
            : '#ccc'};
        `,
        className
      )}
    />
  )
);
// Button Component with fixed BaseProps
// interface ButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'active' | 'reversed'>, BaseProps {
//   active: boolean;
//   reversed: boolean;
// }

// export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
//   ({ className, active, reversed, ...props }, ref) => {
//     // Filter out any non-standard props that might cause issues with cx
//     const buttonProps = { ...props };
//     delete (buttonProps as any).someCustomProp; // Remove any custom props if needed
    
//     return (
//       <button
//         {...buttonProps}
//         ref={ref}
//         className={cx(
//           css`
//             border: none;
//             background: none;
//             padding: 0;
//             cursor: pointer;
//             color: ${reversed
//               ? active
//                 ? 'white'
//                 : '#aaa'
//               : active
//               ? 'black'
//               : '#ccc'};
//           `,
//           className
//         )}
//       />
//     );
//   }
// );



// interface BaseProps {
//   className?: string;
//   [key: string]: unknown;
// }


// // Button Component
// interface ButtonProps extends ComponentPropsWithoutRef<'button'>, BaseProps {
//   active: boolean;
//   reversed: boolean;
// }

// export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
//   ({ className, active, reversed, ...props }, ref) => {
//     // Extract active and reversed from props to prevent them from being passed to the button element
//     const { active: _, reversed: __, ...restProps } = props as any;
    
//     return (
//       <button
//         {...restProps}
//         ref={ref}
//         className={cx(
//           css`
//             border: none;
//             background: none;
//             padding: 0;
//             cursor: pointer;
//             color: ${reversed
//               ? active
//                 ? 'white'
//                 : '#aaa'
//               : active
//               ? 'black'
//               : '#ccc'};
//           `,
//           className
//         )}
//       />
//     );
//   }
// );

// // Button Component - Using ComponentPropsWithoutRef
// interface ButtonProps extends ComponentPropsWithoutRef<'button'>, BaseProps {
//   active: boolean;
//   reversed: boolean;
// }

// export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
//   (
//     {
//       className,
//       active,
//       reversed,
//       ...props
//     },
//     ref
//   ) => (
//     <button
//       {...props}
//       ref={ref}
//       className={cx(
//         css`
//           border: none;
//           background: none;
//           padding: 0;
//           cursor: pointer;
//           color: ${reversed
//             ? active
//               ? 'white'
//               : '#aaa'
//             : active
//             ? 'black'
//             : '#ccc'};
//         `,
//         className
//       )}
//     />
//   )
// );

// Rest of the components remain the same as previous solution...

// Icon Component
interface IconProps extends BaseProps {}

export const Icon: ForwardRefExoticComponent<PropsWithChildren<IconProps> & RefAttributes<HTMLSpanElement>> = React.forwardRef(
  (
    { className, ...props }: PropsWithChildren<IconProps>,
    ref: Ref<HTMLSpanElement>
  ) => (
    <span
      {...props}
      ref={ref}
      className={cx(
        'material-icons',
        className,
        css`
          font-size: 18px;
          vertical-align: text-bottom;
        `
      )}
    />
  )
);

// Instruction Component
interface InstructionProps extends BaseProps {}

export const Instruction: ForwardRefExoticComponent<PropsWithChildren<InstructionProps> & RefAttributes<HTMLDivElement>> = React.forwardRef(
  (
    { className, ...props }: PropsWithChildren<InstructionProps>,
    ref: Ref<HTMLDivElement>
  ) => (
    <div
      {...props}
      ref={ref}
      className={cx(
        className,
        css`
          white-space: pre-wrap;
          margin: 0 -20px 10px;
          padding: 10px 20px;
          font-size: 14px;
          background: #f8f8e8;
        `
      )}
    />
  )
);

// Menu Component
interface MenuProps extends BaseProps {}

export const Menu: ForwardRefExoticComponent<PropsWithChildren<MenuProps> & RefAttributes<HTMLDivElement>> = React.forwardRef(
  (
    { className, ...props }: PropsWithChildren<MenuProps>,
    ref: Ref<HTMLDivElement>
  ) => (
    <div
      {...props}
      data-test-id="menu"
      ref={ref}
      className={cx(
        className,
        css`
          & > * {
            display: inline-block;
          }

          & > * + * {
            margin-left: 15px;
          }
        `
      )}
    />
  )
);

// Portal Component
export const Portal = ({ children }: { children?: ReactNode }) => {
  return typeof document === 'object'
    ? ReactDOM.createPortal(children, document.body)
    : null
};

// Toolbar Component
interface ToolbarProps extends BaseProps {}

export const Toolbar: ForwardRefExoticComponent<PropsWithChildren<ToolbarProps> & RefAttributes<HTMLDivElement>> = React.forwardRef(
  (
    { className, ...props }: PropsWithChildren<ToolbarProps>,
    ref: Ref<HTMLDivElement>
  ) => (
    <Menu
      {...props}
      ref={ref}
      className={cx(
        className,
        css`
          position: relative;
          padding: 1px 18px 17px;
          margin: 0 -20px;
          border-bottom: 2px solid #eee;
          margin-bottom: 20px;
        `
      )}
    />
  )
);

// Add display names for better debugging
Button.displayName = 'Button';
Icon.displayName = 'Icon';
Instruction.displayName = 'Instruction';
Menu.displayName = 'Menu';
Toolbar.displayName = 'Toolbar';



// import React, { PropsWithChildren, RefObject, Ref} from "react";
// import ReactDOM from "react-dom";
// import { cx, css } from "@emotion/css";

// interface BaseProps {
//   className: string;
//   [key: string]: unknown;
// }


// export const Button = React.forwardRef( 
//   ( 
//     {
//       className,
//       active,
//       reversed,
//       ...props
//     }: PropsWithChildren<
//       {
//         active: boolean;
//         reversed: boolean;
//       } & BaseProps
//     >,
//     ref: Ref<HTMLSpanElement>
//     | RefObject<HTMLSpanElement | null>
//     | ((instance: HTMLSpanElement | null) => void)
//     | null
//   ) => (
//     <span
//       {...props}
//       ref={ref}
//       className={cx(
//         className,
//         css`
//           cursor: pointer;
//           color: ${reversed
//             ? active
//               ? "white"
//               : "#aaa"
//             : active
//             ? "black"
//             : "#aaa"};
//         `
//       )}
//     />
//   )
// );

// export const EditorValue = React.forwardRef(
//   (
//     {
//       className,
//       value,
//       ...props
//     }: PropsWithChildren<
//       {
//         value: any;
//       } & BaseProps
//     >,
//     ref:
//       | RefObject<HTMLDivElement | null>
//       | ((instance: HTMLDivElement | null) => void)
//       | null
//   ) => {
//     const textLines = value.document.nodes
//       .map((node: any) => node.text)
//       .toArray()
//       .join("\n");
//     return (
//       <div
//         ref={ref}
//         {...props}
//         className={cx(
//           className,
//           css`
//             margin: 30px -20px 0;
//           `
//         )}
//       >
//         <div
//           className={css`
//             font-size: 14px;
//             padding: 5px 20px;
//             color: #404040;
//             border-top: 2px solid #eeeeee;
//             background: #f8f8f8;
//           `}
//         >
//           Slate's value as text
//         </div>
//         <div
//           className={css`
//             color: #404040;
//             font: 12px monospace;
//             white-space: pre-wrap;
//             padding: 10px 20px;
//             div {
//               margin: 0 0 0.5em;
//             }
//           `}
//         >
//           {textLines}
//         </div>
//       </div>
//     );
//   }
// );

// export const Instruction = React.forwardRef(
//   (
//     { className, ...props }: PropsWithChildren<BaseProps>,
//     ref:
//       | RefObject<HTMLDivElement | null>
//       | ((instance: HTMLDivElement | null) => void)
//       | null
//   ) => (
//     <div
//       {...props}
//       ref={ref}
//       className={cx(
//         className,
//         css`
//           white-space: pre-wrap;
//           margin: 0 -20px 10px;
//           padding: 10px 20px;
//           font-size: 14px;
//           background: #f8f8e8;
//         `
//       )}
//     />
//   )
// );

// export const Menu = React.forwardRef(
//   (
//     { className, ...props }: PropsWithChildren<BaseProps>,
//     ref:
//       | RefObject<HTMLDivElement | null>
//       | ((instance: HTMLDivElement | null) => void)
//       | null
//   ) => (
//     <div
//       {...props}
//       ref={ref}
//       className={cx(
//         className,
//         css`
//           & > * {
//             display: inline-block;
//           }

//           & > * + * {
//             margin-left: 15px;
//           }
//         `
//       )}
//     />
//   )
// );

// export const Portal = ({ children }: { children: React.ReactNode }) => {
//   return ReactDOM.createPortal(children, document.body);
// };

// export const Toolbar = React.forwardRef(
//   (
//     { className, ...props }: PropsWithChildren<BaseProps>,
//     ref:
//       | RefObject<HTMLDivElement | null>
//       | ((instance: HTMLDivElement | null) => void)
//       | null
//   ) => (
//     <Menu
//       {...props}
//       ref={ref}
//       className={cx(
//         className,
//         css`
//           position: relative;
//           padding: 1px 18px 17px;
//           margin: 0 -20px;
//           border-bottom: 2px solid #eee;
//           margin-bottom: 20px;
//         `
//       )}
//     />
//   )
// );