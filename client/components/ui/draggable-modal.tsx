import React from "react";
import { useDraggable } from "@/hooks/useDraggable";
import { cn } from "@/lib/utils";

/**
 * A draggable modal overlay component that replaces the common pattern:
 *   <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 *     <div className="bg-background rounded-2xl shadow-xl ...">
 *       <div className="header...">...</div>
 *       <div className="body...">...</div>
 *     </div>
 *   </div>
 *
 * Usage:
 *   <DraggableModal onClose={handleClose}>
 *     <DraggableModal.Header>
 *       <h2>Title</h2>
 *     </DraggableModal.Header>
 *     <div>Body content</div>
 *   </DraggableModal>
 *
 * Or simply wrap existing modals:
 *   <DraggableModal onClose={handleClose} overlayClassName="..." contentClassName="...">
 *     {children}
 *   </DraggableModal>
 */

interface DraggableModalProps {
  children: React.ReactNode;
  onClose?: () => void;
  overlayClassName?: string;
  contentClassName?: string;
  dir?: "ltr" | "rtl";
}

export function DraggableModal({
  children,
  onClose,
  overlayClassName,
  contentClassName,
  dir,
}: DraggableModalProps) {
  const { dragHandleProps, dialogStyle } = useDraggable();

  // Process children to find DraggableModal.Header and inject drag handle props
  const processedChildren = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && (child.type as any)?.displayName === "DraggableModalHeader") {
      return React.cloneElement(child as React.ReactElement<any>, {
        ...dragHandleProps,
      });
    }
    return child;
  });

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4",
        overlayClassName,
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          "bg-background rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto",
          contentClassName,
        )}
        dir={dir}
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {processedChildren}
      </div>
    </div>
  );
}

// Header sub-component that acts as the drag handle
function DraggableModalHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("p-4 sm:p-6 border-b border-border", className)}
      style={{ ...props.style, cursor: "grab", touchAction: "none" }}
      {...props}
    >
      {children}
    </div>
  );
}
DraggableModalHeader.displayName = "DraggableModalHeader";

DraggableModal.Header = DraggableModalHeader;

export default DraggableModal;
