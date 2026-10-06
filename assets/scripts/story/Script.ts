import { Color, Graphics, HorizontalTextAlignment, Label, Node } from 'cc';
import { GameState, SupporterType } from '../core/GameState';
import { Col, label, labelInBox } from '../core/UITheme';
import { Ctx, Step } from './Runner';

/* ---------------------------------- 开局设置 ---------------------------------- */

export function openingSteps(): Step[] {
    return [
        { k: 'ui', run: async (ctx) => { await ctx.overlay.titleScreen(); } },

        { k: 'dialog', who: 'xiaozhi', text: '欢迎来到《和你一起长大30天》。在故事开始前，你希望大家怎么称呼你？' },
        {
            k: 'ui', run: async (ctx) => {
                const r = await ctx.popup.input({ title: '大家怎么称呼你？', placeholder: '妈妈' });
                GameState.momName = r.value || '妈妈';
                GameState.save();
            },
        },
        { k: 'dialog', who: 'xiaozhi', text: '好的，{mom}。接下来，我们会一起经历等待、生产和宝宝出生后的第一个月。' },

        {
            k: 'ui', run: async (ctx) => {
                const r = await ctx.popup.pick({
                    title: '谁会主要陪你一起经历这段旅程？',
                    options: ['爸爸', '伴侣', '家人', '朋友', '其他', '独自一人'],
                });
                const type = r.value as SupporterType;
                GameState.supporterType = type;
                if (type !== '独自一人') {
                    const ph: Record<string, string> = {
                        爸爸: '爸爸', 伴侣: '伴侣的名字', 家人: '妈妈／姐姐／婆婆…', 朋友: '朋友的名字', 其他: '你希望怎么称呼TA',
                    };
                    const r2 = await ctx.popup.input({ title: '你希望怎么称呼TA？', placeholder: ph[type] ?? type });
                    GameState.supporterName = r2.value || type;
                } else {
                    GameState.supporterName = '';
                }
                GameState.save();
            },
        },
        { k: 'dialog', who: 'xiaozhi', text: '{supporter}会陪在你身边，一直支持你。' },

        {
            k: 'ui', run: async (ctx) => {
                const r = await ctx.popup.input({ title: '你现在怎么称呼肚子里的宝宝？', placeholder: '小月亮', altLabel: '暂时叫宝宝' });
                GameState.babyName = r.alt ? '宝宝' : (r.value || '宝宝');
                GameState.save();
            },
        },
        { k: 'dialog', who: 'xiaozhi', text: '正式名字可以以后再决定。现在，我们先用你最自然的称呼陪宝宝进入故事。' },

        { k: 'achieve', name: '我们的故事开始了' },
    ];
}

/* ---------------------------------- 第一章 ---------------------------------- */

export function chapter1Steps(): Step[] {
    return [
        { k: 'scene', s: 'living-day' },
        { k: 'ui', run: async (ctx) => { await ctx.overlay.chapterCover('第一章｜宝宝的小窝', '孕38周+2天'); } },
        { k: 'badge', text: '孕38周+2天' },

        { k: 'dialog', who: 'mom', text: '{baby}随时都要来了，可家里还有好多东西没有整理。' },
        { k: 'dialog', who: 'mom', text: '……那个角落到现在还是空的。' },
        { k: 'dialog', who: 'supporter', text: '我买了胶带回来。' },
        { k: 'dialog', who: 'supporter', text: '……我们是不是拖太久了？' },

        {
            k: 'choices',
            hint: '（妈妈心里想）',
            options: [
                {
                    t: '别人好像早就准备好了。我们是不是太慢了？',
                    then: [
                        { k: 'dialog', who: 'supporter', text: '你看到的是别人准备好以后展示出来的部分，不是他们全部过程。我们只完成今天最重要的一件事。' },
                        { k: 'dialog', who: 'supporter', text: '而且我们不知道他们准备了多久。' },
                        { k: 'dialog', who: 'supporter', text: '今天只做一件事，行不行？' },
                        { k: 'dialog', who: 'mom', text: '……好。' },
                    ],
                },
                {
                    t: '东西太多了，我不知道应该先做什么。',
                    then: [
                        { k: 'dialog', who: 'xiaozhi', text: '当任务太多时，把它拆成下一步会比一次解决全部更容易。' },
                        { k: 'dialog', who: 'xiaozhi', text: '要不要先决定两件事：今晚她睡在哪里，在哪里换尿布？' },
                        { k: 'dialog', who: 'supporter', text: '这两个我都能帮上忙。' },
                    ],
                },
                {
                    t: '我们不用一次做完所有事。先从宝宝最需要的地方开始，其他可以以后再补。',
                    then: [
                        { k: 'dialog', who: 'supporter', text: '好。我们先布置婴儿床和尿布台吧。' },
                        { k: 'dialog', who: 'supporter', text: '箱子我来拆，你别弯腰。' },
                    ],
                },
            ],
        },

        // 三个可点击任务（睡眠区为拖拽布置小游戏；尿布台本期跳过，点击直接完成；购物清单为分类拖拽小游戏）
        {
            k: 'ui', run: async (ctx) => {
                ctx.dialog.hide();
                ctx.portraits.hide();
                ctx.taskbar.show([
                    { id: 'sleep', icon: 'task_sleep', label: '布置睡眠区' },
                    { id: 'diaper', icon: 'task_diaper', label: '布置尿布台' },
                    { id: 'list', icon: 'task_list', label: '整理购物清单' },
                ]);
                await ctx.taskbar.waitAllDone();
                ctx.taskbar.hide();
            },
        },

        // 章节衔接：夜晚
        {
            k: 'ui', run: async (ctx) => {
                ctx.dialog.hide();
                ctx.portraits.hide();
                await ctx.overlay.fadeIn(new Color(15, 16, 34), 0.5);
                ctx.scene.set('living-night');
                ctx.scene.nightGlow(-60, 60);
                await ctx.overlay.fadeOut(0.5);
            },
        },
        { k: 'dialog', who: 'supporter', text: '{baby}睡觉和换尿布的地方都准备好了。' },
        {
            k: 'choices',
            options: [
                {
                    t: '家里还有很多地方没整理，我还是觉得没准备好。',
                    then: [
                        { k: 'dialog', who: 'supporter', text: '准备好不等于所有东西都完成。今天最重要的部分已经做完了。' },
                    ],
                },
                {
                    t: '是啊，我们已经准备好了。',
                    then: [
                        { k: 'dialog', who: 'supporter', text: '辛苦了。' },
                    ],
                },
                {
                    t: '我不知道自己算不算准备好，但我知道今天做完了什么。',
                    then: [
                        { k: 'dialog', who: 'xiaozhi', text: '把「准备好了吗」换成「今天完成了什么」，会容易回答很多。' },
                    ],
                },
            ],
        },

        {
            k: 'ui', run: async (ctx) => {
                ctx.dialog.hide();
                ctx.portraits.hide();
                await ctx.overlay.card((cardN) => {
                    label(cardN, '今天完成：3 件', { size: 34, bold: true, color: Col.ink }, 0, 130);
                    const rows = ['布置睡眠区', '布置尿布台', '整理购物清单'];
                    rows.forEach((t, i) => {
                        const check = cardN.getChildByName('check' + i) || new Node('check' + i);
                        cardN.addChild(check);
                        check.setPosition(-140, 40 - i * 64);
                        const cg = check.addComponent(Graphics);
                        cg.lineWidth = 5;
                        cg.strokeColor = Col.pink;
                        cg.moveTo(-10, 0);
                        cg.lineTo(-3, -8);
                        cg.lineTo(10, 8);
                        cg.stroke();
                        labelInBox(cardN, t, 300, 44, { size: 28, color: Col.ink, hAlign: HorizontalTextAlignment.LEFT }, 40, 40 - i * 64);
                    });
                }, 2400);
            },
        },

        // 安静的收尾：妈妈与支持者并肩站在婴儿床旁（3 秒）
        { k: 'ui', run: async () => { await new Promise((r) => setTimeout(r, 3000)); } },

        { k: 'ui', run: async (ctx) => { await ctx.phone.chapterCard('第二章｜为生产做准备', '孕39周+1天'); } },
        {
            k: 'ui', run: async (ctx) => {
                ctx.dialog.hide();
                ctx.portraits.hide();
                await ctx.overlay.showEnd('第二章｜为生产做准备', '内容制作中，敬请期待', '—— 第一章完 ——');
            },
        },
    ];
}
