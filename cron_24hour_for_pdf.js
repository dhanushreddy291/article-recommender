const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient()
const { GoogleGenerativeAI } = require("@google/generative-ai");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const doc = require('pdfkit');
require('dotenv').config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const characterCounts = [420, 160, 240, 280, 260];
const indexesOfCharacterCountsBySortedOrder = [4, 0, 1, 2, 3];
const headerText = "WHAT'S TRENDING NOW";
const mainTitle = 'AI SPICE';
const headerFontSize = 13;
const mainTitleFontSize = 90;
const subtitleFontSize = 16;
const dateFontSize = 14;
const titleFontSize = 22;
const contentFontSize = 14;
const headerPosY = 100;
const mainTitlePosY = 110;
const subtitlePosY = 205
const title1PosY = 300;
const title2PosY = 600;
const title3PosY = 100;
const title4PosY = 320;
const title5PosY = 570;
// Current date as dd Month Name year
const dateText = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
});

const downloadImages = async (imageLinks) => {
    let downloaded_images = [];

    // Create the 'images' directory if it doesn't exist
    const imagesDir = path.join(process.cwd(), 'images/newsletter');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    for (let i = 0; i < imageLinks.length; i++) {
        let ext = path.extname(imageLinks[i]).slice(1);
        if (!['jpeg', 'jpg', 'png', 'webp'].includes(ext)) {
            ext = 'jpeg';
        }
        const hash = crypto.createHash('md5').update(imageLinks[i]).digest('hex');
        const fileName = `${hash}.${ext}`;

        // Check if the image is already downloaded
        const filePath = path.join(imagesDir, fileName);
        if (fs.existsSync(filePath)) {
            downloaded_images.push(filePath);
            continue;
        }

        const response = await fetch(imageLinks[i]);

        if (!response.ok) {
            console.error(`Failed to download ${imageLinks[i]}`);
            continue;
        }

        const buffer = await response.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
        downloaded_images.push(filePath);
    }

    return downloaded_images;
};

const fonts = {
    PatrickHand: 'fonts/Patrick_Hand/PatrickHand-Regular.ttf',
    BebasNeue: 'fonts/Bebas_Neue/BebasNeue-Regular.ttf',
    MPlus1Code: 'fonts/M_PLUS_1_Code/static/MPLUS1Code-Regular.ttf'
}


const setBackground = async (doc, bgImage) => {
    const { width, height } = await sharp(bgImage).metadata();
    let aspectRatio = width / height;
    let docWidth = doc.page.width;
    let docHeight = doc.page.height;

    if (docWidth / docHeight < aspectRatio) {
        docWidth = docHeight * aspectRatio;
    } else {
        docHeight = docWidth / aspectRatio;
    }

    const x = (doc.page.width - docWidth) / 2;
    const y = (doc.page.height - docHeight) / 2;

    doc.image(bgImage, x, y, { width: docWidth, height: docHeight });
}

const makeIntroPage = async (doc, bgImage, userName, images, titles, contents, links) => {

    await setBackground(doc, bgImage);

    // Set font color to white
    doc.fillColor('black');

    // Add date at top right
    doc.fontSize(dateFontSize)
        .font(fonts.PatrickHand)
        .text(dateText, 0, headerPosY - 40, { align: 'right' });

    doc.fontSize(headerFontSize)
        .text(headerText, 0, headerPosY, { align: 'center', width: doc.page.width });

    doc.font(fonts.BebasNeue)
        .fontSize(mainTitleFontSize)
        .text(mainTitle, 0, mainTitlePosY, { align: 'center', width: doc.page.width });

    doc.font(fonts.PatrickHand)
        .fontSize(subtitleFontSize)
        .text('just for you ', 210, subtitlePosY, { continued: true })
        .fillColor('#39A7FF')
        .text(`@${userName}`, { continued: false })
        .fillColor('black')
        .text('', { align: 'center', width: doc.page.width });

    // Insert a horizontal line of 2px width
    doc.moveTo(60, subtitlePosY + 50).lineTo(doc.page.width - 60, subtitlePosY + 50)
        .lineWidth(3)
        .stroke();

    // Add the titles[0] at left
    doc.font(fonts.BebasNeue)
        .fontSize(titleFontSize)
        .text(titles[0], 60, title1PosY, {
            align: 'left', width: doc.page.width - 330, link: links[0]
        })

    // Add the contents[0] below titles[0]
    doc.font(fonts.MPlus1Code)
        .fillColor('#39A7FF')
        .fontSize(contentFontSize)
        .text(contents[0], 60, title1PosY + 30, { align: 'left', width: doc.page.width - 330 })

    // Add an image to the right of the content
    doc.image(images[0], doc.page.width - 260, title1PosY, { align: 'right', width: 210, height: 275 });

    // For 2nd post add image below post 1
    doc.image(images[1], 60, title1PosY + 300, { align: 'left', width: 270, height: 200 });

    // Add the titles[1] to the right of the image
    doc.fillColor('black')
        .font(fonts.BebasNeue)
        .fontSize(titleFontSize)
        .text(titles[1], doc.page.width - 245, title2PosY, { align: 'left', width: doc.page.width, link: links[1] });

    // Add the contents[1] below titles[1]
    doc.font(fonts.MPlus1Code)
        .fillColor('#39A7FF')
        .fontSize(contentFontSize)
        .text(contents[1], doc.page.width - 245, title2PosY + 30, { align: 'left', width: doc.page.width - 395 })
}

const makeEvenPages = async (doc, bgImage, images, pdfPageNumber, titles, contents, links) => {
    doc.addPage();

    await setBackground(doc, bgImage);

    // Set font color to white
    doc.fillColor('black');

    // Add date at top right
    doc.fontSize(dateFontSize)
        .font(fonts.PatrickHand)
        .text(dateText, 0, headerPosY - 40, { align: 'right' });

    doc.image(images[(pdfPageNumber - 2) * 3 + 2], 60, title3PosY, { align: 'left', width: 240, height: 200 });

    // Add the titles[2] to right
    doc.font(fonts.BebasNeue)
        .fontSize(titleFontSize)
        .text(titles[(pdfPageNumber - 2) * 3 + 2], doc.page.width - 270, title3PosY, { align: 'left', width: doc.page.width, link: links[(pdfPageNumber - 2) * 3 + 2] })

    // Add the contents[2] below titles[2]
    doc.font(fonts.MPlus1Code)
        .fillColor('#39A7FF')
        .fontSize(contentFontSize)
        .text(contents[(pdfPageNumber - 2) * 3 + 2], doc.page.width - 270, title3PosY + 30, { align: 'left', width: doc.page.width - 360 })

    // For 2nd post add image below post 1
    doc.image(images[(pdfPageNumber - 2) * 3 + 3], doc.page.width - 270, title4PosY, { align: 'left', width: doc.page.width - 370, height: 230 });

    // Add the titles[3] to the right of the image
    doc.fillColor('black')
        .font(fonts.BebasNeue)
        .fontSize(titleFontSize)
        .text(titles[(pdfPageNumber - 2) * 3 + 3], 60, title4PosY, { align: 'left', width: doc.page.width - 340, link: links[(pdfPageNumber - 2) * 3 + 2] })

    // Add the contents[3] below titles[3]
    doc.font(fonts.MPlus1Code)
        .fillColor('#39A7FF')
        .fontSize(contentFontSize)
        .text(contents[(pdfPageNumber - 2) * 3 + 3], 60, title4PosY + 30, { align: 'left', width: doc.page.width - 340 })

    doc.image(images[(pdfPageNumber - 2) * 3 + 4], 60, title5PosY, { align: 'left', width: 240, height: 220 });

    // Add the titles[4] at right
    doc.font(fonts.BebasNeue)
        .fillColor('black')
        .fontSize(titleFontSize)
        .text(titles[(pdfPageNumber - 2) * 3 + 4], doc.page.width - 270, title5PosY, { align: 'left', width: doc.page.width, link: links[(pdfPageNumber - 2) * 3 + 2] });

    // Add the contents[4] below titles[4]
    doc.font(fonts.MPlus1Code)
        .fillColor('#39A7FF')
        .fontSize(contentFontSize)
        .text(contents[(pdfPageNumber - 2) * 3 + 4], doc.page.width - 270, title5PosY + 30, { align: 'left', width: doc.page.width - 360 })
}

const createMagazineCover = async (bgImage, userName, images, articleText) => {
    const doc = new PDFDocument({
        size: 'A4',
        margin: 50
    });
    doc.pipe(fs.createWriteStream('newsletter.pdf'));

    const { titles, contents, links } = articleText;

    // Page 1
    await makeIntroPage(doc, bgImage, userName, images, titles, contents, links);

    // Page 2
    await makeEvenPages(doc, bgImage, images, 2, titles, contents, links);

    doc.end()
}

const shortenTheTitle = async (title) => {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{ text: "I will be sending you a title of a blog post, you need to shorten it into a 3 word title at max, dont send anything beyond 3 words, less than it is fine, but nothing beyond 3 words in length. Don't add quotation marks or anything extra to title, just send it. Don't send anything extra" }],
            },
            {
                role: "model",
                parts: [{ text: "Sure, I will do that." }],
            },
        ],
        generationConfig: {
            maxOutputTokens: 50,
        },
    });

    const result = await chat.sendMessage(title);
    const response = result.response;
    const text = response.text();
    return text;
}

const shortenTitle = async (title) => {
    let shortenedTitle = title;
    let retries = 5;
    while (shortenedTitle.length > 30 && retries > 0) {
        console.log(`Shortening title: ${shortenedTitle}`);
        try {
            shortenedTitle = await shortenTheTitle(title);
        } catch (error) {
            console.error(error);
        }
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return shortenedTitle;
}

const getImageLinksFromMarkdownText = (markdownText) => {

    const imageLinksArray = [];

    // Regular expression pattern to match Markdown image links
    const imageLinksPattern = /!\[(.*?)\]\((.*?)\)/g;

    let match;
    while ((match = imageLinksPattern.exec(markdownText)) !== null) {
        imageLinksArray.push(match[2]);
    }

    return imageLinksArray;
}

const getAllArticles = async () => {
    await prisma.$connect();
    const articles = await prisma.newsletter.findMany({
        select: {
            id: true,
            title: true,
            link: true,
            summary: true,
            updated_at: true,
        },
        where: {
            predicted_value: {
                gte: 2
            },
            summary: {
                not: null
            }
        },
        orderBy: [
            {
                predicted_value: 'desc'
            },
            {
                created_at: 'desc'
            }
        ],
        take: 5
    });


    await prisma.$disconnect();
    return articles;
}

function sortArrays(arr1, arr2) {
    // Create an array of objects that hold the elements from both arrays
    const combined = arr1.map((value, index) => ({ value, relatedValue: arr2[index] }));

    // Sort the combined array based on the 'value' property
    combined.sort((a, b) => a.value.length - b.value.length);

    // Extract the sorted 'value' and 'relatedValue' into separate arrays
    const sortedArr1 = combined.map(obj => obj.value);
    const sortedArr2 = combined.map(obj => obj.relatedValue);

    return [sortedArr1, sortedArr2];
}

const getImageLinkFromUnsplash = async (searchQuery) => {
    try {

        // First make a request to gemini to ask what to search for on unsplash
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "I will be sending you a title of a blog post, you need to tell me what to search for on unsplash to get an image for this title. Don't send anything extra" }],
                },
                {
                    role: "model",
                    parts: [{ text: "Sure, I will do that." }],
                },
            ],
            generationConfig: {
                maxOutputTokens: 50,
            },
        });

        const result = await chat.sendMessage(searchQuery);
        const geminiResponse = result.response;
        const text = geminiResponse.text();

        searchQuery = text;

        const response = await fetch(`https://api.unsplash.com/photos/random?query=${searchQuery}&client_id=${process.env.UNSPLASH_ACCESS_KEY}`);
        const data = await response.json();
        return data.urls.regular;
    } catch (error) {
        return "https://images.unsplash.com/photo-1504711331083-9c895941bf81?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wyODkxNTF8MHwxfHJhbmRvbXx8fHx8fHx8fDE3MTQ1NzY1MzJ8&ixlib=rb-4.0.3&q=80&w=1080";
    }
}

const main = async () => {
    const articles = await getAllArticles();

    let titles = [];
    let contents = [];
    let image_links = [];
    let website_links = [];

    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const title = article.title;
        const summary = article.summary;
        titles.push(title);
        contents.push(summary);
    }

    console.log(titles);
    console.log(contents);

    const [sortedTitles, sortedContents] = sortArrays(titles, contents);

    const rawTitleMap = {};

    for (let i = 0; i < sortedTitles.length; i++) {
        titles[i] = sortedTitles[indexesOfCharacterCountsBySortedOrder[i]];
        contents[i] = sortedContents[indexesOfCharacterCountsBySortedOrder[i]];

        // Trim the content to the character count, dont use substring as it may break a word in between
        let count = 0;
        let finalContent = "";
        // Split contents[i] into words
        let words = contents[i].split(" ");
        let j = 0;
        while (count < characterCounts[i] && j < words.length) {
            finalContent += words[j] + " ";
            count += words[j].length;
            j++;
        }
        if (finalContent.length > characterCounts[i]) {
            const splitWords = finalContent.split(" ");
            splitWords.pop();
            finalContent = splitWords.join(" ");
        }
        finalContent = finalContent.trim();
        if (finalContent[finalContent.length - 1] === "." || finalContent[finalContent.length - 1] === ",") {
            finalContent = finalContent.slice(0, -1);
        }
        contents[i] = finalContent + "...";
    }

    for (let i = 0; i < titles.length; i++) {
        let originalTitle = titles[i];
        if (titles[i].length > 30) {
            titles[i] = await shortenTitle(titles[i]);
            titles[i] = titles[i].replaceAll("*", "");
        }
        rawTitleMap[originalTitle] = titles[i];
    }

    console.log(titles);
    console.log(contents);

    image_links = Array(titles.length).fill("");
    website_links = Array(titles.length).fill("");

    for (let i = 0; i < articles.length; i++) {
        if (rawTitleMap[articles[i].title] !== undefined) {
            const imageLinks = getImageLinksFromMarkdownText(articles[i].raw_jina_text);
            if (imageLinks.length > 0) {
                image_links[titles.indexOf(rawTitleMap[articles[i].title])] = imageLinks[0];
            } else {
                console.log(`Getting unsplash image for ${rawTitleMap[articles[i].title]}`);
                let image_link = await getImageLinkFromUnsplash(rawTitleMap[articles[i].title]);
                image_links[titles.indexOf(rawTitleMap[articles[i].title])] = image_link;
            }
            website_links[titles.indexOf(rawTitleMap[articles[i].title])] = articles[i].link
        }
    }

    const downloaded_images = await downloadImages(image_links);

    await createMagazineCover("images/bg.png", "dhanushreddy291", downloaded_images, {
        titles: titles,
        contents: contents,
        links: website_links
    });
};


main().catch(console.error);