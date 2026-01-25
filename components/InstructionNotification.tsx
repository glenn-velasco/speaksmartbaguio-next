"use client";

interface InstructionNotificationProps {
    message: string;
    code: string;
};

export default function InstructionNotification({ message, code }: InstructionNotificationProps) {
    return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-2">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                {message} <code className="bg-yellow-100 dark:bg-yellow-800 px-1 mx-1 rounded text-yellow-900 dark:text-yellow-100">{code}</code>
            </p>
        </div>
    );
}