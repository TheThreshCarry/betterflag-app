"use client";

import * as React from "react";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@appica/ui-react/drawer";

import { cn } from "@/lib/utils";

type DrawerSide = "top" | "bottom" | "left" | "right";

const SheetSideContext = React.createContext<DrawerSide>("left");

/** Sheet API shim over Appica Drawer for sidebar mobile chrome. */
function Sheet({
  side = "left",
  children,
  ...props
}: React.ComponentProps<typeof Drawer> & { side?: DrawerSide }) {
  return (
    <SheetSideContext.Provider value={side}>
      <Drawer side={side} {...props}>
        {children}
      </Drawer>
    </SheetSideContext.Provider>
  );
}

function SheetTrigger(props: React.ComponentProps<typeof DrawerTrigger>) {
  return <DrawerTrigger {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof DrawerClose>) {
  return <DrawerClose {...props} />;
}

function SheetContent({
  className,
  side: sideProp,
  children,
  ...props
}: Omit<React.ComponentProps<typeof DrawerContent>, "side"> & {
  side?: DrawerSide;
}) {
  const contextSide = React.useContext(SheetSideContext);
  const side = sideProp ?? contextSide;

  return (
    <DrawerContent
      closeButton={false}
      className={cn(
        "max-w-none rounded-none p-0",
        side === "left" && "inset-y-0 left-0 h-full",
        side === "right" && "inset-y-0 right-0 h-full",
        side === "top" && "inset-x-0 top-0 w-full",
        side === "bottom" && "inset-x-0 bottom-0 w-full",
        className,
      )}
      {...props}
    >
      {children}
    </DrawerContent>
  );
}

function SheetHeader(props: React.ComponentProps<typeof DrawerHeader>) {
  return <DrawerHeader {...props} />;
}

function SheetFooter(props: React.ComponentProps<typeof DrawerFooter>) {
  return <DrawerFooter {...props} />;
}

function SheetTitle(props: React.ComponentProps<typeof DrawerTitle>) {
  return <DrawerTitle {...props} />;
}

function SheetDescription(props: React.ComponentProps<typeof DrawerDescription>) {
  return <DrawerDescription {...props} />;
}

function SheetBody(props: React.ComponentProps<typeof DrawerBody>) {
  return <DrawerBody {...props} />;
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetBody,
};
