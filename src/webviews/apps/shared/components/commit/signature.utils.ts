import type { CommitSignatureShape } from '../../../../commitDetails/protocol.js';

const x509EmailRegex = /\/EMail=([^/]+)/i;
const angleBracketEmailRegex = /<([^>]+)>/;
const noPublicKeyRegex = /no public key/i;

export type SignatureState = 'trusted' | 'unknown' | 'untrusted';

/**
 * Extracts the email address from a signer identity string.
 * Handles formats:
 * - GPG: "Name <email@example.com>" -> "email@example.com"
 * - SSH: "email@example.com" -> "email@example.com"
 * - X.509: "/C=US/O=Org/CN=Name/EMail=email@example.com" -> "email@example.com"
 */
export function extractEmailFromSigner(signer: string | undefined): string | undefined {
	if (!signer) return undefined;

	// X.509 Distinguished Name format: extract from /EMail= field
	const x509Match = signer.match(x509EmailRegex);
	if (x509Match) {
		return x509Match[1];
	}

	// GPG format: "Name <email@example.com>"
	const angleMatch = signer.match(angleBracketEmailRegex);
	if (angleMatch) {
		return angleMatch[1];
	}

	// SSH format: just an email address (contains @ and no spaces)
	if (signer.includes('@') && !signer.includes(' ')) {
		return signer;
	}

	return undefined;
}

/**
 * Determines the signature state based on signature properties and committer email.
 * Returns 'trusted' only if:
 * - Signature status is 'good'
 * - Trust level is 'ultimate' or 'full'
 * - Signer email matches committer email (case-insensitive)
 */
export function getSignatureState(
	signature: CommitSignatureShape | undefined,
	committerEmail: string | undefined,
): SignatureState {
	if (signature == null) return 'unknown';

	const { status, trustLevel, signer } = signature;

	// Bad signatures are always untrusted
	if (status === 'bad') {
		return 'untrusted';
	}

	// Good status with ultimate or full trust requires email verification
	if (status === 'good' && (trustLevel === 'ultimate' || trustLevel === 'full')) {
		// Verify that the committer email matches the signer email for trusted status
		const signerEmail = extractEmailFromSigner(signer);

		if (signerEmail && committerEmail) {
			// Case-insensitive email comparison
			if (signerEmail.toLowerCase() === committerEmail.toLowerCase()) {
				return 'trusted';
			}
		}

		// Emails don't match or couldn't be verified - return unknown
		return 'unknown';
	}

	// Everything else is unknown
	return 'unknown';
}

/** Returns the appropriate icon for a signature state */
export function getSignatureIcon(state: SignatureState): string {
	switch (state) {
		case 'trusted':
			return 'workspace-trusted';
		case 'untrusted':
			return 'workspace-untrusted';
		case 'unknown':
		default:
			return 'workspace-unknown';
	}
}

export function getSignatureStatusInfo(
	signature: CommitSignatureShape,
	committerEmail: string | undefined,
): { icon: string; text: string; description?: string | undefined; detail?: string | undefined } {
	const state = getSignatureState(signature, committerEmail);
	const icon = getSignatureIcon(state);

	switch (state) {
		case 'trusted':
			return {
				icon: icon,
				text: '已签名并验证',
				description: '受信任',
				detail: '签名有效且签名者受信任',
			};
		case 'untrusted': {
			return {
				icon: icon,
				text: '无效签名',
				description: '不受信任',
				detail: '签名与提交内容不匹配 — 此提交可能已被篡改',
			};
		}
		case 'unknown': {
			switch (signature.status) {
				case 'good':
					return {
						icon: icon,
						text: '已签名',
						description: '未验证签名者',
						detail: '签名有效，但签名者不在您的受信任密钥中',
					};
				case 'expired':
					return {
						icon: icon,
						text: '已签名',
						description: '已过期',
						detail: '签名使用了过期密钥，无法验证',
					};
				case 'revoked':
					return {
						icon: icon,
						text: '已签名',
						description: '已撤销',
						detail: '签名使用了已撤销的密钥，不应被信任',
					};
				case 'error': {
					const isMissingKey = signature.errorMessage ? noPublicKeyRegex.test(signature.errorMessage) : false;
					if (isMissingKey) {
						return {
							icon: icon,
							text: '已签名',
							description: '缺少密钥',
							detail: '由于公钥不可用，无法验证签名',
						};
					}

					return {
						icon: icon,
						text: '已签名',
						description: '失败',
						detail: signature.errorMessage ? `签名验证失败：${signature.errorMessage}` : '签名验证失败',
					};
				}
				case 'unknown':
				default:
					return {
						icon: icon,
						text: '已签名',
						description: '未验证',
						detail: signature.errorMessage ?? '无法验证签名',
					};
			}
		}
	}
}
