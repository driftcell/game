import { sys } from 'cc';
import { GameState, SupporterType } from './GameState';

/** 单个存档槽的内容（v1） */
export interface SlotData {
    v: number;
    checkpoint: string;   // 剧本段落 id（SEGMENTS）
    label: string;        // 段落展示名
    savedAt: number;
    m: string;            // momName
    st: SupporterType;    // supporterType
    sn: string;           // supporterName
    b: string;            // babyName
    pf?: number[][];      // 生产偏好勾选（第二章）
    sp?: string;          // 最想让医护记住的一条
}

interface GlobalData { achievements: string[]; badge: number; }

const SLOT_KEY = (i: number) => `growup30.slot.v1.${i}`;
const GLOBAL_KEY = 'growup30.global.v1';
const LEGACY_KEY = 'growup30.profile.v1';
export const SLOT_COUNT = 3;

/**
 * 存档管理：3 个槽位 + 一份全局成就。
 * 断点粒度 = 剧本段落，进入段落即写档；读档从该段落开头重跑。
 */
class SaveManagerData {
    /** 当前游玩槽位；-1 = 未入档（标题/菜单阶段），此时 writeCurrent 为无操作 */
    slot = -1;
    currentCheckpoint = 'opening';
    currentLabel = '序幕';

    /** 旧版单档 profile 迁移到槽位 0（视为已完成序幕），成就/角标并入全局 */
    migrate(): void {
        const old = sys.localStorage.getItem(LEGACY_KEY);
        if (!old) return;
        sys.localStorage.removeItem(LEGACY_KEY);
        try {
            const d = JSON.parse(old);
            if (!this.read(0)) {
                this.writeRaw(0, {
                    v: 1, checkpoint: 'ch1-intro', label: '第一章｜宝宝的小窝', savedAt: Date.now(),
                    m: d.m ?? '妈妈', st: d.st ?? '爸爸', sn: d.sn ?? '爸爸', b: d.b ?? '宝宝',
                });
            }
            const g = this.global();
            g.achievements = d.a ?? g.achievements;
            g.badge = d.badge ?? g.badge;
            this.saveGlobal(g);
        } catch (e) { /* 损坏就丢弃 */ }
    }

    global(): GlobalData {
        try {
            const s = sys.localStorage.getItem(GLOBAL_KEY);
            if (s) {
                const d = JSON.parse(s);
                return { achievements: d.a ?? [], badge: d.badge ?? 0 };
            }
        } catch (e) { /* ignore */ }
        return { achievements: [], badge: 0 };
    }

    saveGlobal(g: GlobalData): void {
        try {
            sys.localStorage.setItem(GLOBAL_KEY, JSON.stringify({ a: g.achievements, badge: g.badge }));
        } catch (e) { /* ignore */ }
    }

    list(): (SlotData | null)[] {
        const out: (SlotData | null)[] = [];
        for (let i = 0; i < SLOT_COUNT; i++) out.push(this.read(i));
        return out;
    }

    read(slot: number): SlotData | null {
        try {
            const s = sys.localStorage.getItem(SLOT_KEY(slot));
            if (!s) return null;
            const d = JSON.parse(s);
            if (d.v !== 1 || typeof d.checkpoint !== 'string') return null;
            return d as SlotData;
        } catch (e) { return null; }
    }

    remove(slot: number): void {
        sys.localStorage.removeItem(SLOT_KEY(slot));
    }

    /** 应用槽位档案到 GameState，并把当前槽指向它 */
    apply(slot: number): boolean {
        const d = this.read(slot);
        if (!d) return false;
        GameState.momName = d.m;
        GameState.supporterType = d.st;
        GameState.supporterName = d.sn;
        GameState.babyName = d.b;
        GameState.prefs = d.pf ?? [];
        GameState.starPick = d.sp ?? '';
        this.slot = slot;
        this.currentCheckpoint = d.checkpoint;
        this.currentLabel = d.label;
        return true;
    }

    /** 把当前 GameState + checkpoint 写入当前槽（GameState.persist 挂这里） */
    writeCurrent(): void {
        if (this.slot < 0) return;
        this.writeRaw(this.slot, {
            v: 1, checkpoint: this.currentCheckpoint, label: this.currentLabel, savedAt: Date.now(),
            m: GameState.momName, st: GameState.supporterType, sn: GameState.supporterName, b: GameState.babyName,
            pf: GameState.prefs, sp: GameState.starPick,
        });
        this.saveGlobal({ achievements: GameState.achievements, badge: GameState.badge });
    }

    private writeRaw(slot: number, d: SlotData): void {
        try {
            sys.localStorage.setItem(SLOT_KEY(slot), JSON.stringify(d));
        } catch (e) { /* ignore */ }
    }
}

export const SaveManager = new SaveManagerData();
