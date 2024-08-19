const TelegramBot = require('node-telegram-bot-api');
const NewsAPI = require('newsapi');
const User = require('./models/user');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

const categories = ['technology', 'sports', 'politics'];

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Please subscribe to a category using the buttons below.', {
    reply_markup: {
      keyboard: categories.map(category => [{ text: `/subscribe ${category}` }]),
      one_time_keyboard: true
    }
  });
});

bot.onText(/\/subscribe (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const category = match[1].toLowerCase();

  if (!categories.includes(category)) {
    bot.sendMessage(chatId, 'Invalid category. Please choose from technology, sports, or politics.');
    return;
  }

  const user = await User.findOne({ chatId });

  if (!user) {
    const newUser = new User({ chatId, categories: [category] });
    await newUser.save();
    bot.sendMessage(chatId, `Subscribed to ${category} news.`);
  } else if (!user.categories.includes(category)) {
    user.categories.push(category);
    await user.save();
    bot.sendMessage(chatId, `Subscribed to ${category} news.`);
  } else {
    bot.sendMessage(chatId, `You are already subscribed to ${category} news.`);
  }
});

bot.onText(/\/unsubscribe (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const category = match[1].toLowerCase();

  const user = await User.findOne({ chatId });

  if (user && user.categories.includes(category)) {
    user.categories = user.categories.filter(cat => cat !== category);
    await user.save();
    bot.sendMessage(chatId, `Unsubscribed from ${category} news.`);
  } else {
    bot.sendMessage(chatId, `You are not subscribed to ${category} news.`);
  }
});

const sendNews = async () => {
  const users = await User.find();
  for (const user of users) {
    for (const category of user.categories) {
      const response = await newsapi.v2.topHeadlines({ category });
      const articles = response.articles;
      articles.forEach((article) => {
        bot.sendMessage(user.chatId, `${article.title}\n${article.url}`);
      });
    }
  }
};

setInterval(sendNews, 3600000);

module.exports = bot;
