// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Global signature template stored in R2 and rendered per mailbox.
 *
 * Placeholders: {{email}}, {{domain}}, {{fromName}}
 */

export const SIGNATURE_TEMPLATE_KEY = "settings/signature-template.json";

export const DEFAULT_SIGNATURE_TEMPLATE_TEXT = `—

{{fromName}}
{{email}}
`;

export interface SignatureTemplate {
	enabled: boolean;
	text: string;
}

export interface SignatureTemplateContext {
	email: string;
	fromName?: string;
	name?: string;
}

export function renderSignatureTemplate(
	text: string,
	ctx: SignatureTemplateContext,
): string {
	const email = ctx.email || "";
	const at = email.lastIndexOf("@");
	const domain = at >= 0 ? email.slice(at + 1) : "";
	const fromName = (ctx.fromName || ctx.name || "").trim();
	return text
		.replaceAll("{{email}}", email)
		.replaceAll("{{domain}}", domain)
		.replaceAll("{{fromName}}", fromName);
}
