const Ownermiddleware = async (context, next) => {
    const { m, Owner } = context;

    if (!Owner) {
        return m.reply(`╭─❏ 「 Aᴄᴄᴇss Dᴇɴɪᴇᴅ」
│ You dare use an Owner command?\n│ Your mere existence insults\n│ my code. Crawl back to the\n│ abyss where mediocrity thrives.\n╰───────────────\n> 𝑇𝛩𝛸𝛪𝐶 - Ƭ𝚵₵𝚮`);
    }

    await next();
};

export default Ownermiddleware;
