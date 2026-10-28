import {config} from "./config.js";

const amountRanges = {
    deposit: [500, 2000],
    withdrawal: [30000, 70000],
    win: [10000, 30000],
};

const avatarDirectory = "./assets/images/avatars";

// Fictional profiles only. Avatar assignments are explicit and stay fixed across rotations.
const sampleProfiles = [
    {username: "Aarav_24", primary: "****21", gender: "male", avatar: `${avatarDirectory}/img.png`},
    {username: "Rohan_51", primary: "****46", gender: "male", avatar: `${avatarDirectory}/img_7.png`},
    {username: "Arjun_09", primary: "****17", gender: "male", avatar: `${avatarDirectory}/img_1.png`},
    {username: "Vihaan_18", primary: "****74", gender: "male", avatar: `${avatarDirectory}/img_5.png`},
    {username: "Kavya_87", primary: "****08", gender: "female", avatar: `${avatarDirectory}/img_4.png`},
    {username: "Aditya_72", primary: "****56", gender: "male", avatar: `${avatarDirectory}/img_2.png`},
    {username: "Kabir_39", primary: "****85", gender: "male", avatar: `${avatarDirectory}/img_3.png`},
    {username: "Ishaan_68", primary: "****04", gender: "male", avatar: `${avatarDirectory}/img.png`},
    {username: "Dev_82", primary: "****13", gender: "male", avatar: `${avatarDirectory}/img_7.png`},
    {username: "Meera_32", primary: "****35", gender: "female", avatar: `${avatarDirectory}/img_6.png`},
    {username: "Yash_16", primary: "****52", gender: "male", avatar: `${avatarDirectory}/img_1.png`},
    {username: "Kunal_34", primary: "****38", gender: "male", avatar: `${avatarDirectory}/img_5.png`},
    {username: "Dhruv_23", primary: "****83", gender: "male", avatar: `${avatarDirectory}/img_2.png`},
    {username: "Nikhil_42", primary: "****61", gender: "male", avatar: `${avatarDirectory}/img_3.png`},
    {username: "Isha_63", primary: "****62", gender: "female", avatar: `${avatarDirectory}/img_8.png`},
    {username: "Sahil_07", primary: "****79", gender: "male", avatar: `${avatarDirectory}/img.png`},
    {username: "Varun_94", primary: "****58", gender: "male", avatar: `${avatarDirectory}/img_7.png`},
    {username: "Aryan_56", primary: "****33", gender: "male", avatar: `${avatarDirectory}/img_1.png`},
    {username: "Vivek_31", primary: "****72", gender: "male", avatar: `${avatarDirectory}/img_5.png`},
    {username: "Ananya_45", primary: "****93", gender: "female", avatar: `${avatarDirectory}/img_6.png`},
];

const categories = [
    {secondary: "Deposit", kind: "deposit"},
    {secondary: "Withdrawal", kind: "withdrawal"},
    {secondary: "Win", kind: "win"},
];

/** All entries are labeled demo examples until a verified activity source is connected. */
export function getActivityItems({settings = config, random = Math.random, previousUsername} = {}) {
    const money = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: settings.depositCurrency,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
    });
    const profiles = [...sampleProfiles];
    for (let index = profiles.length - 1; index > 0; index--) {
        const other = Math.floor(random() * (index + 1));
        [profiles[index], profiles[other]] = [profiles[other], profiles[index]];
    }
    if (profiles[0].username === previousUsername) {
        [profiles[0], profiles[1]] = [profiles[1], profiles[0]];
    }
    return profiles.map((profile, index) => {
        const item = {...profile, ...categories[index % categories.length]};
        const [minimum, maximum] = amountRanges[item.kind];
        const step = 500;
        const choices = (maximum - minimum) / step + 1;
        const amount = minimum + Math.floor(random() * choices) * step;
        return {...item, amount, value: money.format(amount)};
    });
}

