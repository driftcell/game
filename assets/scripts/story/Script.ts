import { Color } from 'cc';
import { GameState, SupporterType } from '../core/GameState';
import type { CardRow } from '../ui/KnowledgeCardView';
import { Ctx, Step } from './Runner';

/** 剧本段落：存档断点的最小单位。每段开头必须自带 scene/badge 步骤，保证读档重跑能重建画面 */
export interface Segment {
    id: string;
    label: string;   // 存档槽位展示名
    steps: () => Step[];
}

/* ---------------------------------- 序幕 ---------------------------------- */

function openingSteps(): Step[] {
    // 「自己输入名字」与「暂时叫宝宝」要有不同的回应，用局部标记跨步骤传递本次选择
    let babyNamed = false;
    return [
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
                babyNamed = !r.alt && !!r.value;
                GameState.babyName = babyNamed ? r.value : '宝宝';
                GameState.save();
            },
        },
        {
            k: 'dialog', who: 'xiaozhi', text: () => (babyNamed
                ? '好的，{baby}。从现在起，我们就用这个名字，一起等TA来。'
                : '正式名字可以以后再决定。现在，我们先用你最自然的称呼陪宝宝进入故事。'),
        },

        { k: 'achieve', name: '我们的故事开始了' },
    ];
}

/* ---------------------------------- 知识卡 ---------------------------------- */

/** 布置睡眠区完成后的「安全睡眠五句话」知识卡 */
export const SLEEP_SAFETY_CARD: CardRow[] = [
    { icon: 'kc_separate', text: '与父母同室不同床。' },
    { icon: 'kc_back', text: '仰卧入睡。' },
    { icon: 'kc_flat', text: '平坦睡眠表面。' },
    { icon: 'kc_nopillow', text: '不放枕头、被子、床围、毛绒玩具等松软物品。' },
    { icon: 'kc_nohat', text: '不带帽子避免过热和遮盖头部。' },
];

/* ---------------------------------- 第一章 ---------------------------------- */

function ch1IntroSteps(): Step[] {
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
    ];
}

function ch1TaskSteps(): Step[] {
    return [
        { k: 'scene', s: 'living-day' },
        { k: 'badge', text: '孕38周+2天' },

        // 三个可点击任务（睡眠区为拖拽布置小游戏；尿布台本期跳过，点击直接完成；购物清单为分类拖拽小游戏）
        {
            k: 'ui', run: async (ctx) => {
                ctx.dialog.hide();
                ctx.portraits.hide();
                ctx.taskbar.show([
                    { id: 'sleep', icon: 'task_sleep', label: '布置睡眠区' },
                    { id: 'diaper', icon: 'task_diaper', label: '布置尿布台' },
                    { id: 'list', icon: 'task_list', label: '查看购物清单' },
                ]);
                await ctx.taskbar.waitAllDone();
                ctx.taskbar.hide();
            },
        },
    ];
}

function ch1NightSteps(): Step[] {
    return [
        // 章节衔接：夜晚
        {
            k: 'ui', run: async (ctx) => {
                ctx.dialog.hide();
                ctx.portraits.hide();
                await ctx.overlay.fadeIn(new Color(15, 16, 34), 0.5);
                ctx.scene.set('bedroom-night');
                ctx.scene.nightGlow(40, 95);
                await ctx.overlay.fadeOut(0.5);
            },
        },
        { k: 'badge', text: '孕38周+2天' },

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
    ];
}

function ch1EndSteps(): Step[] {
    return [
        // 读档重跑时重建夜景
        { k: 'scene', s: 'bedroom-night' },
        { k: 'ui', run: async (ctx) => { ctx.scene.nightGlow(40, 95); } },
        { k: 'badge', text: '孕38周+2天' },

        {
            k: 'ui', run: async (ctx) => {
                ctx.dialog.hide();
                ctx.portraits.hide();
                await ctx.overlay.doneSheet(
                    [
                        { icon: 'task_sleep', label: '布置睡眠区' },
                        { icon: 'task_diaper', label: '布置尿布台' },
                        { icon: 'task_list', label: '查看购物清单' },
                    ],
                    '小智：「把『准备好了吗』换成『今天完成了什么』，会容易回答很多。」',
                );
            },
        },

        // 安静的收尾：让卧室夜景停一瞬，然后翻开第二章
        { k: 'ui', run: async () => { await new Promise((r) => setTimeout(r, 1200)); } },

        { k: 'ui', run: async (ctx) => { await ctx.phone.chapterCard('第二章｜为生产做准备', '孕39周+1天'); } },
    ];
}

/* ---------------------------------- 第二章 ---------------------------------- */

function ch2BagSteps(): Step[] {
    return [
        { k: 'ui', run: async (ctx) => {
            ctx.dialog.hide();
            ctx.portraits.hide();
            await ctx.overlay.chapterCover('第二章｜为生产做准备', '孕39周+1天', 'suitcase');
        } },
        { k: 'scene', s: 'bedroom-setup' },
        { k: 'badge', text: '孕39周+1天' },

        { k: 'dialog', who: 'mom', text: '这几天可能随时会发动了，我们来收拾待产包吧。' },

        // 收拾待产包：拖拽装箱小游戏（左半必要 / 右半可选）
        { k: 'ui', run: async (ctx) => {
            ctx.dialog.hide();
            ctx.portraits.hide();
            await ctx.bagPack.play();
        } },

        { k: 'dialog', who: 'mom', text: '我总觉得还漏了什么。' },
        {
            k: 'choices',
            sheet: '妈妈心里想',
            options: [
                {
                    t: '再检查一遍，直到完全不担心为止。',
                    then: [
                        { k: 'dialog', who: 'xiaozhi', text: '反复检查可能短暂降低焦虑，但不会让不确定性消失。我们可以再做一次最终检查。' },
                        { k: 'thought', text: '检查完成。担心的感觉没有变化。' },
                        { k: 'dialog', who: 'xiaozhi', text: '检查是有用的，只是它没办法把「不确定」检查掉。' },
                        { k: 'dialog', who: 'mom', text: '……那我把包放到门口。' },
                    ],
                },
                {
                    t: '我们已经有重要物品和医院联系方式，普通遗漏可以解决。',
                    then: [
                        { k: 'dialog', who: 'supporter', text: '我放到玄关了。从今天起它就一直在那儿。' },
                    ],
                },
                {
                    t: '我现在太焦虑了，先停五分钟，再做最后一次检查。',
                    then: [
                        { k: 'dialog', who: 'xiaozhi', text: '先让身体平静下来，再完成最后检查会更有效。' },
                        { k: 'ui', run: async (ctx) => { await ctx.overlay.breathe(); } },
                        { k: 'dialog', who: 'mom', text: '……好一点了。' },
                        { k: 'dialog', who: 'mom', text: '最后再看一遍，看完就放到门口。' },
                    ],
                },
            ],
        },

        { k: 'achieve', name: '随时可以出发' },
    ];
}

function ch2PrefsSteps(): Step[] {
    return [
        { k: 'scene', s: 'bedroom-setup' },
        { k: 'badge', text: '孕39周+1天' },

        { k: 'thought', text: '{mom}点开了待产包里的「生产偏好文档」。' },

        // 我的生产偏好表单（设计稿 待产包-4）
        { k: 'ui', run: async (ctx) => {
            ctx.dialog.hide();
            ctx.portraits.hide();
            await ctx.prefs.playForm();
        } },

        { k: 'dialog', who: 'xiaozhi', text: '生产偏好是沟通工具，不是必须逐项完成的考试。' },
        { k: 'dialog', who: 'xiaozhi', text: '它更像是一张「我在意什么」的清单，不是一张「必须做到什么」的清单。' },
        {
            k: 'choices',
            options: [
                {
                    t: '如果最后没有按这份计划进行，我会觉得自己失败了。',
                    then: [
                        { k: 'dialog', who: 'xiaozhi', text: '生产方式或镇痛选择不会定义你的能力。计划改变时，你仍可以提问和参与决定。' },
                    ],
                },
                {
                    t: '我可以表达期待，也可以在情况变化时重新决定。',
                    then: [
                        { k: 'dialog', who: 'supporter', text: '这份文档最重要的作用，就是让医护人员知道你在意什么。我们准备好了。' },
                    ],
                },
                {
                    t: '写这么多，会不会显得我很难沟通？',
                    then: [
                        { k: 'dialog', who: 'xiaozhi', text: '医护每天都在做这件事。提前知道你在意什么，反而能省下沟通的时间。' },
                    ],
                },
            ],
        },

        { k: 'dialog', who: 'xiaozhi', text: '如果只能让他们记住一条，你想让他们记住哪一条？' },
        { k: 'ui', run: async (ctx) => {
            ctx.dialog.hide();
            ctx.portraits.hide();
            await ctx.prefs.playStar();
        } },
        { k: 'dialog', who: 'mom', text: '……我想让他们知道，做什么之前先跟我说一声。' },
        { k: 'dialog', who: 'xiaozhi', text: '这一条我记下了。' },

        { k: 'achieve', name: '我的声音很重要' },
    ];
}

function ch2EndSteps(): Step[] {
    return [
        { k: 'scene', s: 'bedroom-setup' },
        { k: 'badge', text: '孕39周+1天' },
        { k: 'ui', run: async (ctx) => {
            ctx.dialog.hide();
            ctx.portraits.hide();
            await ctx.overlay.showEnd('第二章｜为生产做准备', '下一段：第一次肚子发紧', '内容制作中，敬请期待');
        } },
    ];
}

/* ---------------------------------- 段落注册表（顺序即剧情顺序） ---------------------------------- */

export const SEGMENTS: Segment[] = [
    { id: 'opening', label: '序幕', steps: openingSteps },
    { id: 'ch1-intro', label: '第一章｜宝宝的小窝', steps: ch1IntroSteps },
    { id: 'ch1-tasks', label: '第一章｜布置小窝', steps: ch1TaskSteps },
    { id: 'ch1-night', label: '第一章｜夜晚', steps: ch1NightSteps },
    { id: 'ch1-end', label: '第一章｜尾声', steps: ch1EndSteps },
    { id: 'ch2-bag', label: '第二章｜收拾待产包', steps: ch2BagSteps },
    { id: 'ch2-prefs', label: '第二章｜生产偏好', steps: ch2PrefsSteps },
    { id: 'ch2-end', label: '第二章｜尾声', steps: ch2EndSteps },
];
