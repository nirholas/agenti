"use client";

import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Response } from "@/components/ai-elements/response";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
	CheckCircleIcon,
	ChevronDownIcon,
	CircleIcon,
	ClockIcon,
	WrenchIcon,
	XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { CodeBlock } from "./code-block";
import z from "zod";
import { CopyToClipboardButton } from "../copy-to-clipboard";
import Link from "next/link";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
	<Collapsible
		className={cn("not-prose mb-4 w-full rounded-md border", className)}
		{...props}
	/>
);

export type ToolHeaderProps = {
	part: ToolUIPart | DynamicToolUIPart;
	className?: string;
};

const getStatusBadge = (status: ToolUIPart["state"]) => {
	const labels = {
		"input-streaming": "Pending",
		"input-available": "Running",
		"output-available": "Completed",
		"output-error": "Error",
	} as const;

	const icons = {
		"input-streaming": <CircleIcon className="size-4" />,
		"input-available": <ClockIcon className="size-4 animate-pulse" />,
		"output-available": <CheckCircleIcon className="size-4 text-green-600" />,
		"output-error": <XCircleIcon className="size-4 text-red-600" />,
	} as const;

	return (
		<Badge className="rounded-full text-xs" variant="secondary">
			{icons[status]}
			{labels[status]}
		</Badge>
	);
};

const mapRenderResultTypeToState = (
	type: RenderOutputResult["type"],
): ToolUIPart["state"] => {
	if (type === "success") return "output-available";
	if (type === "error") return "output-error";
	return "output-error";
};

export const ToolHeader = ({ className, part, ...props }: ToolHeaderProps) => {
	const { state: rawState } = part;
	const renderResult = renderRawOutput({ output: part.output });
	const state =
		rawState === "output-available" && part.type === "dynamic-tool"
			? mapRenderResultTypeToState(renderResult.type)
			: rawState;

	const toolname =
		part.type === "dynamic-tool" ? part.toolName : part.type.slice(5);

	return (
		<CollapsibleTrigger
			className={cn(
				"flex w-full items-center justify-between gap-4 p-3",
				className,
			)}
			{...props}
		>
			<div className="flex items-center gap-2">
				<WrenchIcon className="size-4 text-muted-foreground" />
				<span className="font-medium text-sm">{toolname}</span>
				{getStatusBadge(state)}
			</div>
			<ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
		</CollapsibleTrigger>
	);
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
	<CollapsibleContent
		className={cn(
			"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
			className,
		)}
		{...props}
	/>
);

export type ToolInputProps = ComponentProps<"div"> & {
	input: ToolUIPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
	<div className={cn("space-y-2 overflow-hidden p-4", className)} {...props}>
		<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
			Parameters
		</h4>
		<div className="rounded-md bg-muted/50">
			<CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
		</div>
	</div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
	part: ToolUIPart | DynamicToolUIPart;
	network?: "base-sepolia" | "base";
};

export const ToolOutput = ({
	className,
	part,
	network,
	...props
}: ToolOutputProps) => {
	const renderResult =
		part.type === "dynamic-tool"
			? renderRawOutput({ output: part.output })
			: ({ type: "non-dynamic-tool", content: part.output } as const);
	const errorText = part.errorText
		? part.errorText
		: renderResult.type === "error"
			? JSON.stringify(renderResult.content)
			: undefined;

	if (!(part.output || errorText)) {
		return null;
	}

	return (
		<div className={cn("space-y-3 p-4", className)} {...props}>
			<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
				{errorText ? "Error" : "Result"}
			</h4>
			<div
				className={cn(
					"overflow-x-auto rounded-md text-xs [&_table]:w-full",
					errorText ? "text-destructive" : "bg-muted/50 text-foreground",
				)}
			>
				{errorText && <div>{errorText}</div>}
				{renderResult.type === "success" ? (
					renderResult.content
				) : renderResult.type === "non-dynamic-tool" ? (
					JSON.stringify(renderResult.content)
				) : renderResult.type === "failed-to-parse" ? (
					<CodeBlock
						code={JSON.stringify(renderResult.content, null, 2)}
						language="json"
					/>
				) : null}
			</div>
			{/* @ts-expect-error */}
			{part.output?._meta?.["x402.payment-response"] && (
				<>
					<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						<i>x402</i> Payment
					</h4>
					<div className="flex items-center gap-2">
						<Link
							href={`https://${
								network === "base-sepolia" ? "sepolia." : ""
								// @ts-expect-error
							}basescan.org/tx/${part.output._meta["x402.payment-response"].transaction}`}
							target="_blank"
							className="hover:underline"
						>
							<div className="overflow-x-auto rounded-md text-xs [&_table]:w-full">
								{/* @ts-expect-error */}
								{part.output._meta["x402.payment-response"].transaction}{" "}
							</div>
						</Link>
						<CopyToClipboardButton
							// @ts-expect-error
							content={part.output._meta["x402.payment-response"].transaction}
						/>
					</div>
				</>
			)}
		</div>
	);
};

const ToolOutputSchema = z
	.object({
		content: z.array(
			z.object({
				type: z.literal("text"),
				text: z.string(),
			}),
		),
		isError: z.boolean().optional(),
	})
	.optional();

type RenderOutputResult =
	| {
			type: "success";
			content: ReactNode;
	  }
	| {
			type: "error";
			content: string;
	  }
	| {
			type: "failed-to-parse";
			content: unknown;
	  };

function renderRawOutput({
	output,
}: {
	output: ToolUIPart["output"];
}): RenderOutputResult {
	const parseResult = ToolOutputSchema.safeParse(output);
	if (!parseResult.success) {
		return {
			type: "failed-to-parse",
			content: output,
		};
	}
	if (!parseResult.data) {
		return {
			type: "success",
			content: null,
		};
	}
	if (parseResult.data.isError) {
		return {
			type: "error",
			content: parseResult.data.content.map((item) => item.text).join(""),
		};
	}
	return {
		type: "success",
		content: (
			<Response>
				{parseResult.data.content.map((item) => item.text).join("")}
			</Response>
		),
	};
}
