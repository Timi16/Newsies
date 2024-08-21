const TelegramBot = require('node-telegram-bot-api');
const NewsAPI = require('newsapi');
const mongoose = require('mongoose');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

const categories = ['technology', 'sports', 'politics'];

mongoose.connect(process.env.MONGO_URI);

// Define User schema and model
const userSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  categories: { type: [String], default: [] }
});
const User = mongoose.model('User', userSchema);

const getMainMenuKeyboard = () => {
  return {
    keyboard: [
      [{ text: 'News Update' }, { text: 'Manage Subscriptions' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
};

const getSubscriptionKeyboard = (userCategories) => {
  return categories.map(category => {
    const subscribed = userCategories.includes(category);
    return [{
      text: subscribed ? `Unsubscribe from ${category}` : `Subscribe to ${category}`,
      callback_data: `${subscribed ? 'unsubscribe' : 'subscribe'}_${category}`
    }];
  });
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await User.findOne({ chatId });

  if (!user) {
    await new User({ chatId }).save();
  }

  bot.sendMessage(chatId, 'Welcome! Use the buttons below to manage your subscriptions or get news updates:', {
    reply_markup: getMainMenuKeyboard()
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

  const user = await User.findOne({ chatId });
  bot.sendMessage(chatId, 'Please choose a category to subscribe or unsubscribe:', {
    reply_markup: {
      inline_keyboard: getSubscriptionKeyboard(user.categories)
    }
  });
});

const handleSubscription = async (chatId, category) => {
  const user = await User.findOne({ chatId });

  if (user && !user.categories.includes(category)) {
    user.categories.push(category);
    await user.save();
    bot.sendMessage(chatId, `Subscribed to ${category} news.`);
    await sendNewsForCategory(chatId, category);
  } else {
    bot.sendMessage(chatId, `You are already subscribed to ${category} news.`);
  }
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
    language: 'en'
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

const sendNews = async (chatId) => {
  const user = await User.findOne({ chatId });
  if (!user || user.categories.length === 0) {
    bot.sendMessage(chatId, 'You are not subscribed to any categories. Please subscribe to categories first.');
    return;
  }

  for (const category of user.categories) {
    await sendNewsForCategory(chatId, category);
  }
};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === 'Manage Subscriptions') {
    const user = await User.findOne({ chatId });
    bot.sendMessage(chatId, 'Please choose a category to subscribe or unsubscribe:', {
      reply_markup: {
        inline_keyboard: getSubscriptionKeyboard(user?.categories || [])
      }
    });
  } else if (msg.text === 'News Update') {
    await sendNews(chatId); // Fetches and sends the latest news based on the user's subscriptions
  } else if (msg.text === '/menu') {
    bot.sendMessage(chatId, 'Main Menu:', {
      reply_markup: getMainMenuKeyboard()
    });
  }
});

setInterval(async () => {
  const users = await User.find();
  for (const user of users) {
    for (const category of user.categories) {
      await sendNewsForCategory(user.chatId, category);
    }
  }
}, 3600000); // Sends news updates every hour to all users

module.exports = bot;
