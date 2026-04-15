"use client";

import { Callout } from "@radix-ui/themes";
import { Info } from "lucide-react";

interface InstructionNotificationProps {
    message: string;
    code: string;
};

export default function InstructionNotification({ message, code }: InstructionNotificationProps) {
    return (
        <Callout.Root color="yellow" size="1" mb="2">
            <Callout.Icon>
                <Info className="w-4 h-4" />
            </Callout.Icon>
            <Callout.Text>
                {message} <code style={{ background: "var(--yellow-a3)", padding: "0 4px", borderRadius: "var(--radius-1)" }}>{code}</code>
            </Callout.Text>
        </Callout.Root>
    );
}