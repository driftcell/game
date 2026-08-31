import { sys } from 'cc';

export type SupporterType = '爸爸' | '伴侣' | '家人' | '朋友' | '其他' | '独自一人';

const KEY = 'growup30.profile.v1';

/** 全局游戏状态（玩家档案 + 成就） */
class GameStateData {
    momName = '妈妈';
    supporterType: SupporterType = '爸爸';
    supporterName = '爸爸';
    babyName = '宝宝';
    achievements: string[] = [];
    /** 手机角标（成长记录数） */
    badge = 0;

    load(): void {
        try {
            const s = sys.localStorage.getItem(KEY);
            if (!s) return;
            const d = JSON.parse(s);
            this.momName = d.m ?? this.momName;
            this.supporterType = d.st ?? this.supporterType;
            this.supporterName = d.sn ?? this.supporterName;
            this.babyName = d.b ?? this.babyName;
            this.achievements = d.a ?? [];
            this.badge = d.badge ?? 0;
        } catch (e) { /* 忽略损坏的存档 */ }
    }

    save(): void {
        try {
            sys.localStorage.setItem(KEY, JSON.stringify({
                m: this.momName, st: this.supporterType, sn: this.supporterName,
                b: this.babyName, a: this.achievements, badge: this.badge,
            }));
        } catch (e) { /* ignore */ }
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
