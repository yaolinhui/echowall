/**
 * 内容版本管理
 * 
 * 管理内容更新、跨平台镜像、衍生关系
 */

import {
  Content,
  ContentVersion,
  ContentDiff,
  VersionRelation,
} from './types';

export interface VersionManagerOptions {
  maxVersionsPerContent?: number;
  keepDiffHistory?: boolean;
}

export class VersionManager {
  private versions: Map<string, ContentVersion> = new Map();
  private contentVersions: Map<string, string[]> = new Map(); // contentId -> versionIds
  private canonicalGroups: Map<string, Set<string>> = new Map(); // canonicalId -> contentIds
  private options: Required<VersionManagerOptions>;

  constructor(options: VersionManagerOptions = {}) {
    this.options = {
      maxVersionsPerContent: options.maxVersionsPerContent || 100,
      keepDiffHistory: options.keepDiffHistory ?? true,
    };
  }

  /**
   * 注册新内容
   */
  registerContent(content: Content, canonicalId?: string): ContentVersion {
    const versionId = this.generateVersionId();
    const canonical = canonicalId || content.id;
    
    const version: ContentVersion = {
      id: versionId,
      contentId: content.id,
      canonicalId: canonical,
      version: 1,
      relation: 'MIRROR',
      content: content.content,
      createdAt: new Date(),
    };

    this.versions.set(versionId, version);
    this.addToContentVersions(content.id, versionId);
    this.addToCanonicalGroup(canonical, content.id);

    return version;
  }

  /**
   * 注册内容更新
   */
  registerUpdate(
    content: Content,
    previousContentId: string
  ): ContentVersion {
    const previousVersions = this.contentVersions.get(previousContentId) || [];
    const lastVersion = previousVersions.length > 0
      ? this.versions.get(previousVersions[previousVersions.length - 1])
      : undefined;
    
    const versionNumber = lastVersion ? lastVersion.version + 1 : 1;
    const versionId = this.generateVersionId();
    
    const diff = this.options.keepDiffHistory && lastVersion
      ? this.calculateDiff(lastVersion.content, content.content)
      : undefined;

    const version: ContentVersion = {
      id: versionId,
      contentId: content.id,
      canonicalId: lastVersion?.canonicalId || content.id,
      version: versionNumber,
      relation: 'UPDATE',
      parentId: previousContentId,
      content: content.content,
      diff,
      createdAt: new Date(),
    };

    this.versions.set(versionId, version);
    this.addToContentVersions(content.id, versionId);
    
    // 维护版本数量限制
    this.cleanupOldVersions(content.id);

    return version;
  }

  /**
   * 注册跨平台镜像
   */
  registerMirror(
    content: Content,
    originalContentId: string,
    platform: string
  ): ContentVersion {
    const originalVersions = this.contentVersions.get(originalContentId);
    const originalVersion = originalVersions?.length > 0
      ? this.versions.get(originalVersions[0])
      : undefined;
    
    const versionId = this.generateVersionId();
    
    const version: ContentVersion = {
      id: versionId,
      contentId: content.id,
      canonicalId: originalVersion?.canonicalId || originalContentId,
      version: 1,
      relation: 'MIRROR',
      parentId: originalContentId,
      content: content.content,
      createdAt: new Date(),
    };

    this.versions.set(versionId, version);
    this.addToContentVersions(content.id, versionId);
    this.addToCanonicalGroup(version.canonicalId, content.id);

    return version;
  }

  /**
   * 注册衍生内容（引用、改编等）
   */
  registerDerived(
    content: Content,
    sourceContentId: string,
    relation: Extract<VersionRelation, 'DERIVED' | 'TRANSLATION' | 'REPLY'>
  ): ContentVersion {
    const versionId = this.generateVersionId();
    
    const version: ContentVersion = {
      id: versionId,
      contentId: content.id,
      canonicalId: content.id, // 衍生内容有自己的canonicalId
      version: 1,
      relation,
      parentId: sourceContentId,
      content: content.content,
      createdAt: new Date(),
    };

    this.versions.set(versionId, version);
    this.addToContentVersions(content.id, versionId);
    this.addToCanonicalGroup(content.id, content.id);

    return version;
  }

  /**
   * 获取内容的所有版本
   */
  getVersions(contentId: string): ContentVersion[] {
    const versionIds = this.contentVersions.get(contentId) || [];
    return versionIds
      .map(id => this.versions.get(id))
      .filter((v): v is ContentVersion => v !== undefined);
  }

  /**
   * 获取最新版本
   */
  getLatestVersion(contentId: string): ContentVersion | undefined {
    const versions = this.getVersions(contentId);
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
  }

  /**
   * 获取特定版本
   */
  getVersion(versionId: string): ContentVersion | undefined {
    return this.versions.get(versionId);
  }

  /**
   * 获取canonical组的所有内容
   */
  getCanonicalGroup(canonicalId: string): ContentVersion[] {
    const contentIds = this.canonicalGroups.get(canonicalId);
    if (!contentIds) return [];

    const versions: ContentVersion[] = [];
    for (const contentId of contentIds) {
      const contentVersions = this.getVersions(contentId);
      versions.push(...contentVersions);
    }

    return versions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * 获取内容谱系
   */
  getLineage(contentId: string): {
    ancestors: ContentVersion[];
    self: ContentVersion[];
    descendants: ContentVersion[];
  } {
    const self = this.getVersions(contentId);
    const ancestors: ContentVersion[] = [];
    const descendants: ContentVersion[] = [];

    // 向上追溯
    let current = self[0];
    while (current?.parentId) {
      const parentVersions = this.contentVersions.get(current.parentId);
      if (parentVersions && parentVersions.length > 0) {
        const parent = this.versions.get(parentVersions[0]);
        if (parent) {
          ancestors.unshift(parent);
          current = parent;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // 向下查找
    this.findDescendants(contentId, descendants);

    return { ancestors, self, descendants };
  }

  /**
   * 递归查找后代
   */
  private findDescendants(contentId: string, results: ContentVersion[]): void {
    for (const version of this.versions.values()) {
      if (version.parentId === contentId) {
        results.push(version);
        this.findDescendants(version.contentId, results);
      }
    }
  }

  /**
   * 计算差异
   */
  private calculateDiff(oldContent: string, newContent: string): ContentDiff {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    const added: string[] = [];
    const removed: string[] = [];
    const modified: Array<{ old: string; new: string }> = [];

    // 简单行级diff（生产环境应使用更复杂的算法如Myers diff）
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);

    for (const line of newLines) {
      if (!oldSet.has(line)) {
        // 可能是新增或修改
        const similarOld = oldLines.find(old => 
          this.calculateSimilarity(old, line) > 0.5
        );
        if (similarOld) {
          modified.push({ old: similarOld, new: line });
        } else {
          added.push(line);
        }
      }
    }

    for (const line of oldLines) {
      if (!newSet.has(line) && !modified.some(m => m.old === line)) {
        removed.push(line);
      }
    }

    return { added, removed, modified };
  }

  /**
   * 计算文本相似度
   */
  private calculateSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein距离
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  /**
   * 清理旧版本
   */
  private cleanupOldVersions(contentId: string): void {
    const versionIds = this.contentVersions.get(contentId);
    if (!versionIds || versionIds.length <= this.options.maxVersionsPerContent) {
      return;
    }

    // 保留最近的版本
    const toRemove = versionIds.slice(0, versionIds.length - this.options.maxVersionsPerContent);
    
    for (const versionId of toRemove) {
      this.versions.delete(versionId);
    }

    this.contentVersions.set(
      contentId,
      versionIds.slice(-this.options.maxVersionsPerContent)
    );
  }

  /**
   * 添加到内容版本列表
   */
  private addToContentVersions(contentId: string, versionId: string): void {
    const existing = this.contentVersions.get(contentId) || [];
    existing.push(versionId);
    this.contentVersions.set(contentId, existing);
  }

  /**
   * 添加到canonical组
   */
  private addToCanonicalGroup(canonicalId: string, contentId: string): void {
    const existing = this.canonicalGroups.get(canonicalId) || new Set();
    existing.add(contentId);
    this.canonicalGroups.set(canonicalId, existing);
  }

  /**
   * 生成版本ID
   */
  private generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalVersions: number;
    uniqueContents: number;
    canonicalGroups: number;
  } {
    return {
      totalVersions: this.versions.size,
      uniqueContents: this.contentVersions.size,
      canonicalGroups: this.canonicalGroups.size,
    };
  }
}
