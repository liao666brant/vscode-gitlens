import type { RemoteResource } from '../models/remoteResource.js';
import { RemoteResourceType } from '../models/remoteResource.js';

// | {
// 		type: RemoteResourceType.Tag;
// 		tag: string;
//   };
export function getNameFromRemoteResource(resource: RemoteResource): string {
	switch (resource.type) {
		case RemoteResourceType.Branch:
			return '分支';
		case RemoteResourceType.Branches:
			return '分支';
		case RemoteResourceType.Commit:
			return '提交';
		case RemoteResourceType.Comparison:
			return '对比';
		case RemoteResourceType.CreatePullRequest:
			return '创建拉取请求';
		case RemoteResourceType.File:
			return '文件';
		case RemoteResourceType.Repo:
			return '仓库';
		case RemoteResourceType.Revision:
			return '文件';
		// case RemoteResourceType.Tag:
		// 	return 'Tag';
		default:
			return '';
	}
}
