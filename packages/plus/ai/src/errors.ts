export const enum AIErrorReason {
	DeniedByOrganization,
	DeniedByUser,
	NoEntitlement,
	NoRequestData,
	RateLimitExceeded,
	RateLimitOrFundsExceeded,
	RequestTooLarge,
	ModelNotSupported,
	ServiceCapacityExceeded,
	Unauthorized,
	UserQuotaExceeded,
	NoNetwork,
	Unreachable,
}

export class AIError extends Error {
	readonly original?: Error;
	readonly reason: AIErrorReason | undefined;

	constructor(reason: AIErrorReason, original?: Error) {
		let message;
		switch (reason) {
			case AIErrorReason.NoEntitlement:
				message = '您没有使用此功能所需的权限';
				break;
			case AIErrorReason.RequestTooLarge:
				message = '请求过大';
				break;
			case AIErrorReason.UserQuotaExceeded:
				message = '您已超出用户令牌限制';
				break;
			case AIErrorReason.RateLimitExceeded:
				message = '超出速率限制';
				break;
			case AIErrorReason.RateLimitOrFundsExceeded:
				message = '超出速率限制或账户余额不足';
				break;
			case AIErrorReason.ServiceCapacityExceeded:
				message = '服务容量已超出';
				break;
			case AIErrorReason.NoNetwork:
				message = '无法连接到 AI 服务，请检查网络连接';
				break;
			case AIErrorReason.Unreachable:
				message = 'AI 服务暂时不可达';
				break;
			case AIErrorReason.NoRequestData:
				message = original?.message ?? '未提供请求数据';
				break;
			case AIErrorReason.ModelNotSupported:
				message = '此请求不支持该模型';
				break;
			case AIErrorReason.Unauthorized:
				message = '您无权使用指定的提供商或模型';
				break;
			case AIErrorReason.DeniedByOrganization:
				message = '您的组织已拒绝访问指定的提供商或模型';
				break;
			case AIErrorReason.DeniedByUser:
				message = '您已拒绝访问指定的提供商或模型';
				break;
			default:
				message = original?.message ?? '发生未知错误';
				break;
		}

		super(message);

		this.original = original;
		this.reason = reason;
		Error.captureStackTrace?.(this, new.target);
	}
}

export class AuthenticationRequiredError extends Error {
	constructor() {
		super('需要身份验证');

		Error.captureStackTrace?.(this, new.target);
	}
}

export class AINoRequestDataError extends AIError {
	constructor(message?: string) {
		super(AIErrorReason.NoRequestData, message ? new Error(message) : undefined);

		Error.captureStackTrace?.(this, new.target);
	}
}

const noNetworkErrorCodes = new Set([
	'ENOTFOUND',
	'ECONNREFUSED',
	'EAI_AGAIN',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'ENETDOWN',
	'UND_ERR_CONNECT_TIMEOUT',
]);

const unreachableErrorCodes = new Set(['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_SOCKET']);

export function classifyNetworkError(ex: unknown): AIErrorReason.NoNetwork | AIErrorReason.Unreachable | undefined {
	let current: unknown = ex;
	let sawFetchFailed = false;
	for (let depth = 0; depth < 5 && current != null; depth++) {
		if (!(current instanceof Error)) break;

		if (current.name === 'TypeError' && current.message === 'fetch failed') {
			sawFetchFailed = true;
		}
		const code = (current as { code?: unknown }).code;
		if (typeof code === 'string') {
			if (noNetworkErrorCodes.has(code)) return AIErrorReason.NoNetwork;
			if (unreachableErrorCodes.has(code)) return AIErrorReason.Unreachable;
		}

		current = (current as { cause?: unknown }).cause;
	}
	return sawFetchFailed ? AIErrorReason.NoNetwork : undefined;
}
