/**
 * 慢慢商店的商品池。
 * 商店只卖「家」和「照顾宝宝」相关的东西，不卖限时、不卖数值；
 * 价格都是小星星，完成小游戏、成就和知识卡收集就能攒到。
 */
export type ShopCategoryId = 'wood' | 'soft' | 'baby' | 'out';

export interface ShopCategory {
    id: ShopCategoryId;
    name: string;
    note: string;
    /** 展示台的底色（ShopView 使用） */
    tint: [number, number, number];
}

export interface ShopProduct {
    id: string;
    name: string;
    /** 资源 key，商品缩略图 */
    asset: string;
    price: number;
    category: ShopCategoryId;
    /** 商品卡上的一行小标签 */
    tag: string;
    desc: string;
}

export const SHOP_CATEGORIES: ShopCategory[] = [
    { id: 'wood', name: '暖木家居', note: '把房间慢慢填满', tint: [248, 232, 218] },
    { id: 'soft', name: '布丁软装', note: '软软的小东西', tint: [251, 234, 239] },
    { id: 'baby', name: '小星星童装', note: '宝宝每天都要用', tint: [250, 238, 219] },
    { id: 'out', name: '出门准备', note: '随时可以出发', tint: [233, 241, 233] },
];

export const SHOP_PRODUCTS: ShopProduct[] = [
    // 暖木家居
    {
        id: 'crib', name: '婴儿床', asset: 'crib', price: 180, category: 'wood', tag: '安全认证',
        desc: '实木婴儿床，栏杆间距符合安全标准。区别只在颜色和造型，床内不加床围。',
    },
    {
        id: 'mattress', name: '婴儿床垫', asset: 'mattress', price: 120, category: 'wood', tag: '安全睡眠',
        desc: '坚实、平坦、贴合床架，是安全睡眠的第一步。',
    },
    {
        id: 'basket', name: '收纳筐', asset: 'basket', price: 80, category: 'wood', tag: '收纳',
        desc: '把零散的小东西收在一起，房间立刻松一口气。',
    },
    {
        id: 'pad', name: '尿布台软垫', asset: 'pad', price: 55, category: 'wood', tag: '日常',
        desc: '垫在尿布台上，宝宝躺得更舒服，弄脏了也好清洗。',
    },
    {
        id: 'bag_case', name: '待产包', asset: 'bag_case', price: 160, category: 'wood', tag: '第二章',
        desc: '随时可以出发。证件、衣物和充电线都有位置。',
    },

    // 布丁软装
    {
        id: 'night_light', name: '小夜灯', asset: 'night_light', price: 60, category: 'soft', tag: '夜间',
        desc: '夜里喂奶的暖光，不刺眼，也不会把宝宝完全照醒。',
    },
    {
        id: 'mobile', name: '床铃', asset: 'mobile', price: 70, category: 'soft', tag: '清醒时用',
        desc: '挂在宝宝够不到的位置，醒着的时候看。睡觉前记得移开。',
    },
    {
        id: 'plush', name: '毛绒玩具', asset: 'plush', price: 50, category: 'soft', tag: '睡眠安全',
        desc: '抱着很软，但睡觉时不要放进婴儿床。可以放在宝宝够不到的小架上。',
    },
    {
        id: 'hat', name: '软帽', asset: 'hat', price: 40, category: 'soft', tag: '出门',
        desc: '出门挡风，睡觉时不戴，避免过热和遮住眼睛。',
    },
    {
        id: 'sleep_bag', name: '睡袋', asset: 'sleep_bag', price: 90, category: 'soft', tag: '安全睡眠',
        desc: '比被子更贴合，宝宝踢不开，也不会盖住口鼻。',
    },
    {
        id: 'socks', name: '小袜子', asset: 'socks', price: 30, category: 'soft', tag: '日常',
        desc: '小脚保暖，穿之前翻一翻里面有没有线头。',
    },

    // 小星星童装
    {
        id: 'clothes', name: '连体衣', asset: 'clothes', price: 70, category: 'baby', tag: '日常',
        desc: '纯棉好穿脱，先备 3–5 件就够换洗，宝宝长得很快。',
    },
    {
        id: 'diaper', name: '纸尿裤', asset: 'diaper', price: 20, category: 'baby', tag: '消耗品',
        desc: '每天都要用的消耗品，先备一小包，不用一次囤太多。',
    },
    {
        id: 'wipes', name: '湿巾', asset: 'wipes', price: 15, category: 'baby', tag: '消耗品',
        desc: '换尿布、擦手都用得上。选无香、成分简单的就好。',
    },
    {
        id: 'cream', name: '护臀膏', asset: 'cream', price: 25, category: 'baby', tag: '护理',
        desc: '红屁屁很常见，换完尿布薄薄涂一层，保持干爽。',
    },
    {
        id: 'lotion', name: '润肤乳', asset: 'lotion', price: 25, category: 'baby', tag: '护理',
        desc: '洗完澡后涂一涂，宝宝的皮肤不容易干燥。',
    },
    {
        id: 'bag_baby', name: '婴儿包被', asset: 'bag_baby', price: 60, category: 'baby', tag: '出门',
        desc: '出院和出门时裹一裹。车里不要用厚包被代替安全带。',
    },

    // 出门准备
    {
        id: 'bag_seat', name: '安全提篮', asset: 'bag_seat', price: 180, category: 'out', tag: '安全出行',
        desc: '出院第一天就要用。提篮不能放在高处或软的表面上。',
    },
    {
        id: 'bag_id', name: '证件袋', asset: 'bag_id', price: 40, category: 'out', tag: '待产包',
        desc: '把证件和产检资料放在一起，家里人也能一下找到。',
    },
    {
        id: 'bag_doc', name: '产检资料', asset: 'bag_doc', price: 35, category: 'out', tag: '待产包',
        desc: '产检本、化验单和知情同意书，住院时随手就能拿出来。',
    },
    {
        id: 'bag_wash', name: '洗漱包', asset: 'bag_wash', price: 50, category: 'out', tag: '待产包',
        desc: '牙刷、毛巾和护肤品，装成一包，出发时不手忙脚乱。',
    },
    {
        id: 'bag_charger', name: '充电线', asset: 'bag_charger', price: 30, category: 'out', tag: '待产包',
        desc: '长一点的线更实用，床头插座也够得着。',
    },
    {
        id: 'bag_snack', name: '小零食', asset: 'bag_snack', price: 20, category: 'out', tag: '待产包',
        desc: '等宫缩、等检查的时候，补充一点能量。',
    },
];

export function productsOf(category: ShopCategoryId): ShopProduct[] {
    return SHOP_PRODUCTS.filter((p) => p.category === category);
}

export function productById(id: string): ShopProduct | undefined {
    return SHOP_PRODUCTS.find((p) => p.id === id);
}
