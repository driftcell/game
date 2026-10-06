export type SupporterType = '爸爸' | '伴侣' | '家人' | '朋友' | '其他' | '独自一人';

/** 全局游戏状态（内存态；持久化由 SaveManager 负责，通过 persist 钩子回写） */
class GameStateData {
    momName = '妈妈';
    supporterType: SupporterType = '爸爸';
    supporterName = '爸爸';
    babyName = '宝宝';
    /** 成就与手机角标为全局数据，跨存档共享 */
    achievements: string[] = [];
    badge = 0;

    /** 持久化钩子，由 GameApp 接到 SaveManager.writeCurrent */
    persist: () => void = () => {};

    save(): void {
        this.persist();
    }

    /** 新游戏：只重置玩家档案，保留全局成就 */
    reset(): void {
        this.momName = '妈妈';
        this.supporterType = '爸爸';
        this.supporterName = '爸爸';
        this.babyName = '宝宝';
    }

    /** 支持者显示名；独自一人时由其功能性台词由小智承担 */
    supporterLabel(): string {
        return this.supporterType === '独自一人' ? '小智' : (this.supporterName || this.supporterType);
    }

    /** 剧情文本变量替换：{mom} {baby} {supporter} */
    subst(text: string): string {
        return text
            .replace(/\{mom\}/g, this.momName)
            .replace(/\{baby\}/g, this.babyName)
            .replace(/\{supporter\}/g, this.supporterLabel());
    }
}

export const GameState = new GameStateData();
