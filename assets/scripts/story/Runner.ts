import { Col } from '../core/UITheme';
import { GameState } from '../core/GameState';
import type { BagPackView } from '../ui/BagPackView';
import type { BottomNav } from '../ui/BottomNav';
import type { ChoiceView } from '../ui/ChoiceView';
import type { DialogView } from '../ui/DialogView';
import type { HouseView } from '../ui/HouseView';
import type { Hud } from '../ui/Hud';
import type { PhoneView } from '../ui/PhoneView';
import type { PopupView } from '../ui/PopupView';
import type { Portraits } from '../ui/Portraits';
import type { PrefsView } from '../ui/PrefsView';
import type { SceneKind, SceneView } from '../ui/SceneView';
import type { TaskBar } from '../ui/TaskBar';
import type { ThoughtView } from '../ui/ThoughtView';
import type { Overlay } from '../ui/Overlay';

export type Speaker = 'mom' | 'supporter' | 'xiaozhi';

export type Step =
    // text 可为函数：用于需要按运行时状态（如弹窗输入结果）决定台词的场景
    | { k: 'dialog'; who: Speaker; text: string | (() => string) }
    | { k: 'choices'; hint?: string; sheet?: string; options: { t: string; then?: Step[] }[] }
    | { k: 'thought'; text: string }
    | { k: 'scene'; s: SceneKind }
    | { k: 'badge'; text: string }
    | { k: 'achieve'; name: string }
    | { k: 'ui'; run: (ctx: Ctx) => Promise<void> };

export interface Ctx {
    dialog: DialogView;
    portraits: Portraits;
    choices: ChoiceView;
    thought: ThoughtView;
    popup: PopupView;
    scene: SceneView;
    house: HouseView;
    taskbar: TaskBar;
    hud: Hud;
    phone: PhoneView;
    overlay: Overlay;
    bagPack: BagPackView;
    prefs: PrefsView;
    nav: BottomNav;
}

function speakerInfo(who: Speaker): { label: string; portrait: Speaker } {
    switch (who) {
        case 'mom': return { label: GameState.momName, portrait: 'mom' };
        case 'supporter': return { label: GameState.supporterLabel(), portrait: 'supporter' };
        case 'xiaozhi': return { label: '小智', portrait: 'xiaozhi' };
    }
}

/** 顺序执行一段剧情脚本 */
export async function runSteps(ctx: Ctx, steps: Step[]): Promise<void> {
    for (const s of steps) await runStep(ctx, s);
}

async function runStep(ctx: Ctx, s: Step): Promise<void> {
    switch (s.k) {
        case 'dialog': {
            const info = speakerInfo(s.who);
            ctx.portraits.show(info.portrait);
            ctx.dialog.root.active = true;
            const raw = typeof s.text === 'function' ? s.text() : s.text;
            await ctx.dialog.say(info.label, Col.pinkDeep, GameState.subst(raw));
            break;
        }
        case 'choices': {
            ctx.portraits.hide();
            ctx.dialog.hide();
            const texts = s.options.map((o) => GameState.subst(o.t));
            const idx = s.sheet
                ? await ctx.choices.chooseSheet(GameState.subst(s.sheet), texts)
                : await ctx.choices.choose(s.hint ?? null, texts);
            ctx.choices.hide();
            const opt = s.options[idx];
            if (opt.then && opt.then.length) await runSteps(ctx, opt.then);
            break;
        }
        case 'thought': {
            ctx.dialog.hide();
            await ctx.thought.show(GameState.subst(s.text));
            break;
        }
        case 'scene':
            ctx.scene.set(s.s);
            break;
        case 'badge':
            await ctx.hud.time.appear(s.text);
            break;
        case 'achieve':
            // 读档重跑时按名字去重，不重复弹绶带
            if (GameState.achievements.indexOf(s.name) < 0) {
                GameState.achievements.push(s.name);
                GameState.badge++;
                GameState.stars += 10;
                GameState.save();
                ctx.phone.setBadge(GameState.badge);
                ctx.nav.flashStars(10);
                await ctx.hud.banner.show(s.name);
            }
            break;
        case 'ui':
            await s.run(ctx);
            break;
    }
}
