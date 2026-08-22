// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Lossless image optimization for attachments.
 * 
 * Reduces file size without changing pixels:
 * - Strips EXIF/metadata from JPEG (without re-encoding DCT coefficients)
 * - Strips metadata chunks from PNG
 * - Never applies lossy compression or changes dimensions
 */

interface OptimizationResult {
	optimizedFile: File;
	originalSize: number;
	optimizedSize: number;
	saved: number;
}

/**
 * Strip EXIF/metadata from JPEG by removing APP marker segments.
 * Preserves DCT coefficients - truly lossless.
 */
async function stripJpegMetadata(file: File): Promise<File> {
	const arrayBuffer = await file.arrayBuffer();
	const view = new DataView(arrayBuffer);
	
	// Check for JPEG signature (FF D8)
	if (view.getUint8(0) !== 0xFF || view.getUint8(1) !== 0xD8) {
		return file; // Not a valid JPEG
	}
	
	const output: number[] = [];
	let offset = 0;
	
	// Copy SOI marker (FF D8)
	output.push(0xFF, 0xD8);
	offset = 2;
	
	while (offset < view.byteLength - 1) {
		// Find next marker
		if (view.getUint8(offset) !== 0xFF) {
			break;
		}
		
		const marker = view.getUint8(offset + 1);
		
		// SOS (Start of Scan) means image data follows - keep everything from here
		if (marker === 0xDA) {
			for (let i = offset; i < view.byteLength; i++) {
				output.push(view.getUint8(i));
			}
			break;
		}
		
		// Standalone markers (no length field)
		if (marker === 0x00 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) {
			output.push(0xFF, marker);
			offset += 2;
			continue;
		}
		
		// Get segment length
		if (offset + 3 >= view.byteLength) break;
		const length = view.getUint16(offset + 2);
		
		// Keep essential markers, strip APP0-APP15 (EXIF, etc.)
		const keepMarker = !(marker >= 0xE0 && marker <= 0xEF);
		
		if (keepMarker) {
			// Copy marker and its data
			for (let i = 0; i < length + 2; i++) {
				output.push(view.getUint8(offset + i));
			}
		}
		
		offset += length + 2;
	}
	
	// Only return optimized version if it's actually smaller
	const optimizedBlob = new Blob([new Uint8Array(output)], { type: 'image/jpeg' });
	if (optimizedBlob.size < file.size) {
		return new File([optimizedBlob], file.name, { type: file.type });
	}
	
	return file;
}

/**
 * Strip ancillary chunks from PNG (like tEXt, iTXt, tIME, etc.)
 * Keeps critical chunks (IHDR, PLTE, IDAT, IEND) and tRNS for transparency.
 */
async function stripPngMetadata(file: File): Promise<File> {
	const arrayBuffer = await file.arrayBuffer();
	const view = new DataView(arrayBuffer);
	
	// Check PNG signature
	const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
	for (let i = 0; i < 8; i++) {
		if (view.getUint8(i) !== pngSignature[i]) {
			return file; // Not a valid PNG
		}
	}
	
	const output: number[] = [];
	
	// Copy PNG signature
	for (let i = 0; i < 8; i++) {
		output.push(view.getUint8(i));
	}
	
	let offset = 8;
	
	while (offset < view.byteLength) {
		if (offset + 8 > view.byteLength) break;
		
		const length = view.getUint32(offset);
		const chunkType = String.fromCharCode(
			view.getUint8(offset + 4),
			view.getUint8(offset + 5),
			view.getUint8(offset + 6),
			view.getUint8(offset + 7)
		);
		
		// Critical chunks we must keep, plus tRNS for transparency, sRGB/iCCP for color
		const keepChunk = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'sRGB', 'iCCP'].includes(chunkType);
		
		if (keepChunk) {
			// Copy entire chunk (length + type + data + CRC)
			for (let i = 0; i < length + 12; i++) {
				output.push(view.getUint8(offset + i));
			}
		}
		
		offset += length + 12;
		
		// IEND is the last chunk
		if (chunkType === 'IEND') break;
	}
	
	const optimizedBlob = new Blob([new Uint8Array(output)], { type: 'image/png' });
	if (optimizedBlob.size < file.size) {
		return new File([optimizedBlob], file.name, { type: file.type });
	}
	
	return file;
}

/**
 * Optimize image file losslessly.
 * Only optimizes if result is smaller than original.
 */
export async function optimizeImageLossless(file: File): Promise<OptimizationResult> {
	const originalSize = file.size;
	let optimizedFile = file;
	
	if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
		optimizedFile = await stripJpegMetadata(file);
	} else if (file.type === 'image/png') {
		optimizedFile = await stripPngMetadata(file);
	}
	// For other formats (WebP, GIF, etc.), return as-is
	
	const optimizedSize = optimizedFile.size;
	const saved = originalSize - optimizedSize;
	
	return {
		optimizedFile,
		originalSize,
		optimizedSize,
		saved,
	};
}
