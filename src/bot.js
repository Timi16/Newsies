const TelegramBot = require('node-telegram-bot-api');
const NewsAPI = require('newsapi');
const User = require('./models/user');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

const categories = ['technology', 'sports', 'politics'];

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome! Please choose a category to subscribe:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Technology', callback_data: 'subscribe_technology' }],
        [{ text: 'Sports', callback_data: 'subscribe_sports' }],
        [{ text: 'Politics', callback_data: 'subscribe_politics' }],
      ],
    },
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;
  const [command, category] = action.split('_');

  if (command === 'subscribe') {
    await handleSubscription(chatId, category);
  } else if (command === 'unsubscribe') {
    await handleUnsubscription(chatId, category);
  }
});

const handleSubscription = async (chatId, category) => {
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

  // Fetch and send the latest news for the subscribed category
  await sendNewsForCategory(chatId, category);
};

const handleUnsubscription = async (chatId, category) => {
  const user = await User.findOne({ chatId });

  if (user && user.categories.includes(category)) {
    user.categories = user.categories.filter(cat => cat !== category);
    await user.save();
    bot.sendMessage(chatId, `Unsubscribed from ${category} news.`);
  } else {
    bot.sendMessage(chatId, `You are not subscribed to ${category} news.`);
  }
};

const sendNewsForCategory = async (chatId, category) => {
  const response = await newsapi.v2.topHeadlines({
    category,
    language: 'en',
  });

  const articles = response.articles;
  if (articles.length > 0) {
    articles.forEach((article) => {
      bot.sendMessage(chatId, `${article.title}\n${article.url}`);
    });
  } else {
    bot.sendMessage(chatId, `No news articles found for ${category}.`);
  }
};

const sendNews = async () => {
  const users = await User.find();
  for (const user of users) {
    for (const category of user.categories) {
      await sendNewsForCategory(user.chatId, category);
    }
  }
};

setInterval(sendNews, 3600000);

module.exports = bot;
