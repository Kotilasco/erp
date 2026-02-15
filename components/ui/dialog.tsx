import * as React from "react"
import { Dialog as HeadlessDialog, Transition } from "@headlessui/react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Fragment, useState, useContext, createContext } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DialogContext = createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

export const Dialog = ({ children, open, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : internalOpen;
    const handleOpenChange = (val: boolean) => {
        if (!isControlled) setInternalOpen(val);
        onOpenChange?.(val);
    };

    return (
        <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
            {children}
        </DialogContext.Provider>
    );
};

export const DialogTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
    const { onOpenChange } = useContext(DialogContext);
    // If asChild is true, we should clone the child and add onClick.
    // For simplicity, if not using a real slot, we just wrap.
    // But Radix slot is complex. Here we assume child is a button.
    
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children as React.ReactElement<any>, {
            onClick: (e: React.MouseEvent) => {
                children.props.onClick?.(e);
                onOpenChange(true);
            }
        });
    }

    return (
        <button onClick={() => onOpenChange(true)}>
            {children}
        </button>
    );
};

export const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    const { open, onOpenChange } = useContext(DialogContext);

    return (
        <Transition show={open} as={Fragment}>
        <HeadlessDialog as="div" className="relative z-50" onClose={() => onOpenChange(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>
  
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <HeadlessDialog.Panel className={cn("w-full max-w-lg transform overflow-hidden rounded-md bg-white p-6 text-left align-middle shadow-xl transition-all", className)}>
                  {children}
                </HeadlessDialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </HeadlessDialog>
      </Transition>
    );
};

export const DialogHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)}>
        {children}
    </div>
);

export const DialogFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4", className)}>
        {children}
    </div>
);

export const DialogTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <HeadlessDialog.Title as="h3" className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
        {children}
    </HeadlessDialog.Title>
);

export const DialogDescription = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <HeadlessDialog.Description className={cn("text-sm text-slate-500", className)}>
        {children}
    </HeadlessDialog.Description>
);
