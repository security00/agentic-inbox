// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Email sending via Cloudflare Email Service binding.
 *
 * Uses the `send_email` Worker binding (`env.EMAIL.send()`) to send emails.
 *
 * See: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
 *
 * Attachment content note (Workers binding ≠ REST API):
 * - Workers binding: `content` must be raw bytes (`ArrayBuffer` / `ArrayBufferView`).
 *   A string is treated as UTF-8 text, NOT base64 — so base64 from the UI must be decoded
 *   before `binding.send()`. Official example:
 *   https://developers.cloudflare.com/email-service/examples/email-sending/email-attachments/
 * - REST API: expects base64 strings. Do not pass binding-decoded bytes back into REST.
 * Callers (compose / reply / forward) still send base64 strings over the HTTP API;
 * `storeAttachments` decodes for R2 separately. This module is the single decode-for-send exit.
 */

export type AttachmentContent = string | ArrayBuffer | ArrayBufferView;

export interface SendEmailParams {
	to: string | string[];
	from: string | { email: string; name: string };
	subject: string;
	html?: string;
	text?: string;
	cc?: string | string[];
	bcc?: string | string[];
	replyTo?: string | { email: string; name: string };
	attachments?: {
		/** Base64 string from the HTTP API, or raw bytes if already decoded. */
		content: AttachmentContent;
		filename: string;
		type: string;
		disposition: "attachment" | "inline";
		contentId?: string;
	}[];
	headers?: Record<string, string>;
}

/**
 * Decode attachment content for the Workers Email binding.
 * Strings are treated as base64 (API/UI contract). Binary is passed through.
 * Does not strip a `data:*;base64,` prefix — callers must send pure base64.
 */
export function toBindingAttachmentContent(content: AttachmentContent): ArrayBuffer | ArrayBufferView {
	if (typeof content === "string") {
		const binaryStr = atob(content);
		return Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
	}
	return content;
}

/**
 * Send an email using the Cloudflare Email Service binding.
 *
 * @param binding  - The `EMAIL` SendEmail binding from env
 * @param params   - Email parameters (to, from, subject, body, etc.)
 * @returns The send result with messageId
 * @throws On validation or delivery errors (error has `.code` property)
 */
export async function sendEmail(
	binding: SendEmail,
	params: SendEmailParams,
): Promise<{ messageId: string }> {
	const message: Record<string, unknown> = {
		to: params.to,
		from: params.from,
		subject: params.subject,
	};

	if (params.html) message.html = params.html;
	if (params.text) message.text = params.text;
	if (params.cc) message.cc = params.cc;
	if (params.bcc) message.bcc = params.bcc;
	if (params.replyTo) message.replyTo = params.replyTo;

	if (params.headers && Object.keys(params.headers).length > 0) {
		message.headers = params.headers;
	}

	if (params.attachments && params.attachments.length > 0) {
		message.attachments = params.attachments.map((att) => ({
			content: toBindingAttachmentContent(att.content),
			filename: att.filename,
			type: att.type,
			disposition: att.disposition,
			...(att.contentId ? { contentId: att.contentId } : {}),
		}));
	}

	const result = await binding.send(message as any);
	return { messageId: result.messageId };
}
