// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "~/services/api";
import type { SignatureTemplate } from "~/types";
import { queryKeys } from "./keys";

export function useSignatureTemplate() {
	return useQuery<SignatureTemplate>({
		queryKey: queryKeys.signatureTemplate,
		queryFn: () => api.getSignatureTemplate(),
	});
}

export function useUpdateSignatureTemplate() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: SignatureTemplate) => api.updateSignatureTemplate(data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.signatureTemplate });
		},
	});
}
