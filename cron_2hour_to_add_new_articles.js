const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const util = require('util');
const execPromise = util.promisify(require('child_process').exec);
require('dotenv').config();

const createTable = async () => {
    await prisma.$connect();
    // Need to create vector as well if it doesn't exist
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS newsletter (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL UNIQUE,
        link TEXT NOT NULL,
        hn_link TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        predicted_value INT DEFAULT NULL,
        embedding vector(768),
        raw_text TEXT,
        summary TEXT
    )`;
    await prisma.$disconnect();
}

const getRawText = async (link, hn_link) => {
    try {
        const response = await axios.get(`https://r.jina.ai/${link}`);
        const text = await response.data;
        return text;
    }
    catch (e) {
        let retries = 2;
        while (retries > 0) {
            try {
                const response = await axios.get(`https://r.jina.ai/${hn_link}`);
                const text = await response.data;
                return text;
            }
            catch (e) {
                retries--;
                await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
            }
        }
        console.error(e);
    }
}

const getSummary = async (raw_text, title) => {
    try {
        const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + process.env.GEMINI_API_KEY, {
            contents: [
                {
                    parts: [
                        {
                            text: `I am sending you a raw markdown text. You need to summarize it for me into 4-5 lines. Here is the text:\n\n${raw_text}.\nDon't send anything apart from the summary. Only send the summary in the response as a normal text.`
                        }
                    ]
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.data;
        return data.candidates[0].content.parts[0].text;

    }
    catch (e) {
        console.error(e);
        return title;
    }
}

// We need to copy few articles from articles table to newsletter table. Copy just the title, link, hn_link columns, ids are in .env
const copyArticles = async () => {
    await prisma.$connect();

    if (process.env.PREDICTED_VALUE_THREE_IDS) {
        const ids = process.env.PREDICTED_VALUE_THREE_IDS.split(',').map(Number).join(',');
        await prisma.$executeRawUnsafe(`INSERT INTO newsletter (title, link, hn_link, predicted_value)
        SELECT title, link, hn_link, 3 FROM articles WHERE id IN (${ids})
        ON CONFLICT (title) DO NOTHING`);
    }

    if (process.env.PREDICTED_VALUE_TWO_IDS) {
        const ids = process.env.PREDICTED_VALUE_TWO_IDS.split(',').map(Number).join(',');
        await prisma.$executeRawUnsafe(`INSERT INTO newsletter (title, link, hn_link, predicted_value)
        SELECT title, link, hn_link, 2 FROM articles WHERE id IN (${ids})
        ON CONFLICT (title) DO NOTHING`);
    }

    if (process.env.PREDICTED_VALUE_ONE_IDS) {
        const ids = process.env.PREDICTED_VALUE_ONE_IDS.split(',').map(Number).join(',');
        await prisma.$executeRawUnsafe(`INSERT INTO newsletter (title, link, hn_link, predicted_value)
        SELECT title, link, hn_link, 1 FROM articles WHERE id IN (${ids})
        ON CONFLICT (title) DO NOTHING`);
    }

    if (process.env.PREDICTED_VALUE_ZERO_IDS) {
        const ids = process.env.PREDICTED_VALUE_ZERO_IDS.split(',').map(Number).join(',');
        await prisma.$executeRawUnsafe(`INSERT INTO newsletter (title, link, hn_link, predicted_value)
        SELECT title, link, hn_link, 0 FROM articles WHERE id IN (${ids})
        ON CONFLICT (title) DO NOTHING`);
    }

    await prisma.$disconnect();
}

const addEmbeddings = async () => {
    try {
        const { stdout, stderr } = await execPromise("./venv/bin/python add_embeddings.py");
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    } catch (error) {
        console.error(`exec error: ${error}`);
    }
}

// We need to add summary and raw_text columns to newsletter table for the rows we inserted
const prepareTheDB = async () => {
    await prisma.$connect();
    const rows = await prisma.newsletter.findMany({
        where: {
            OR: [
                { raw_text: null },
                { summary: null }
            ]
        },
        select: {
            id: true,
            title: true,
            link: true,
            hn_link: true
        }
    });
    console.log(`Found ${rows.length} rows without raw_text and summary`);
    for (var i = 0; i < rows.length; i++) {
        const row = rows[i];
        const { id, title, link, hn_link } = row;
        try {
            const raw_text = await getRawText(link, hn_link);
            const summary = await getSummary(raw_text, title);
            await prisma.newsletter.update({
                where: { id },
                data: { raw_text, summary, updated_at: new Date() }
            });
            console.log(`For i = ${i}, added ${title}`);
        } catch (e) {
            console.error(e);
        }
    }
    await prisma.$disconnect();

    // Currently prisma doesn't work with embeddings, so just run python file "add_embeddings.py" to add embeddings as a workaround
    // Invoke the python script to add embeddings asynchrounously
    exec("./venv/bin/python add_embeddings.py", (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
}

const scrapeNewArticles = async () => {
    const hackerNewsURL = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const response = await axios.get(hackerNewsURL);
    const topStories = response.data;

    await prisma.$connect();

    for (var i = 0; i < 20; i++) {
        try {
            const storyURL = `https://hacker-news.firebaseio.com/v0/item/${topStories[i]}.json`;
            const storyResponse = await axios.get(storyURL);
            const story = storyResponse.data;
            const title = story.title;
            const hn_link = `https://news.ycombinator.com/item?id=${story.id}`;

            // Check if title already exists in the database
            const existing = await prisma.newsletter.findFirst({
                where: {
                    title
                }
            });

            if (existing) {
                // Then just update the updated_at column
                await prisma.newsletter.update({
                    where: { id: existing.id },
                    data: { updated_at: new Date() }
                });
            } else {
                // Get the raw text and summary
                const raw_text = await getRawText(story.url, hn_link);
                const summary = await getSummary(raw_text, title);

                const link = story.url || hn_link;

                // Insert the new article
                await prisma.newsletter.create({
                    data: {
                        title,
                        link,
                        hn_link,
                        raw_text,
                        summary,
                        updated_at: new Date()
                    }
                });
                console.log(`Added ${title}`);
            }
        } catch (e) {
            console.error(e);
        }
    }

    await prisma.$disconnect();
}

const runPrediction = async () => {
    try {
        const { stdout, stderr } = await execPromise("./venv/bin/python predict.py");
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    } catch (error) {
        console.error(`exec error: ${error}`);
    }
}

async function main() {
    // Add CREATE_TABLE=true in your .env file to create the table
    if (process.env.CREATE_TABLE === 'true') {
        await createTable();
    };
    if (process.env.COPY_ARTICLES === 'true') {
        await copyArticles();
    }
    if (process.env.PREPARE_THE_DB === 'true') {
        await prepareTheDB();
    }
    if (process.env.TRAIN_MODEL === 'true') {
        exec("./venv/bin/python train.py", (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
        });
    }
    await scrapeNewArticles();
    await addEmbeddings();
    await runPrediction();
};

main().catch(e => console.error(e));