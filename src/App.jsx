import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MessageSquare, Phone, Activity, Car, Bell, Mic, Send, Plus, X, Check, AlertCircle, BookOpen, ShoppingCart, DollarSign, PenTool, Download } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { IntentLauncher } from '@capgo/capacitor-intent-launcher';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';

const storage = {
  get: async (key) => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set: async (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.error(err); }
  }
};
export default function PersonalAIAssistant() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [voiceInput, setVoiceInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [shoppingList, setShoppingList] = useState([]); 
  const [bookPages, setBookPages] = useState([]); 
  const [garageItems, setGarageItems] = useState([]); 
  
  const [phonePrompt, setPhonePrompt] = useState({ show: false, contactId: null, contactName: '', tempPhone: '' });
  const [isListening, setIsListening] = useState(false);
  const [notes, setNotes] = useState([]);
  
  // 🚀 НОВО: Състояния за API ключа (заместваме стария .env ключ)
  const [userApiKey, setUserApiKey] = useState('');
  const [showApiSetup, setShowApiSetup] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

const loadData = async () => {
    const savedAlarms = await storage.get('alarms');
    const savedContacts = await storage.get('contacts');
    const savedReminders = await storage.get('reminders');
    const savedShopping = await storage.get('shoppingList');
    const savedBook = await storage.get('bookPages'); 
    const savedGarage = await storage.get('garageItems');
	const savedNotes = await storage.get('notes');
    
    if (savedAlarms) setAlarms(savedAlarms);
    if (savedContacts) setContacts(savedContacts);
    if (savedReminders) setReminders(savedReminders);
    if (savedShopping) setShoppingList(savedShopping);
    if (savedBook) setBookPages(savedBook);
    if (savedGarage) setGarageItems(savedGarage);
	if (savedNotes) setNotes(savedNotes);

    // 🚀 НОВО: Проверяваме дали потребителят вече си е въвел ключа
    const savedKey = await storage.get('user_api_key');
    if (savedKey) {
      setUserApiKey(savedKey);
    } else {
      setShowApiSetup(true); // Ако няма ключ, показваме екрана за въвеждане
    }
  };

  const clearChat = () => {
    setChatHistory([]);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const speakText = async (text, langCode = 'bg-BG') => {
    if (Capacitor.isNativePlatform()) {
      try {
        await TextToSpeech.speak({ text: text, lang: langCode, rate: 1.0, pitch: 1.0, volume: 1.0 });
      } catch (error) { console.error("Native TTS Error:", error); }
    } else {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode; utterance.rate = 1.0;
      let voices = window.speechSynthesis.getVoices();
      const startSpeaking = () => {
        voices = window.speechSynthesis.getVoices();
        const targetLangPrefix = langCode.split('-')[0];
        const voice = voices.find(v => v.lang.startsWith(targetLangPrefix) || v.lang.includes(targetLangPrefix));
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
      };
      if (voices.length === 0) window.speechSynthesis.onvoiceschanged = startSpeaking;
      else startSpeaking();
    }
  };

  const startListening = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        setIsListening(true);
        const permissions = await SpeechRecognition.checkPermissions();
        if (permissions.speechRecognition !== 'granted') await SpeechRecognition.requestPermissions();
        const result = await SpeechRecognition.start({ language: 'bg-BG', maxResults: 1, prompt: 'Кажете команда...', partialResults: false, popup: true });
        if (result && result.matches && result.matches.length > 0) {
          setVoiceInput(result.matches[0]);
          setTimeout(() => { const btn = document.getElementById('send-btn'); if(btn) btn.click(); }, 500);
        }
      } catch (error) { alert("Грешка с микрофона."); } finally { setIsListening(false); }
    } else {
      const WebSpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!WebSpeechRec) { alert('Работи само в APK!'); return; }
      const recognition = new WebSpeechRec(); recognition.lang = 'bg-BG';
      recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false); recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => { setVoiceInput(event.results[0][0].transcript); setTimeout(() => document.getElementById('send-btn')?.click(), 500); };
      recognition.start();
    }
  };

  const processVoiceCommand = async () => {
    if (!voiceInput.trim()) return;
    setIsProcessing(true);
    const userMessage = voiceInput;
    setVoiceInput('');
    const newChatHistory = [...chatHistory, { role: 'user', content: userMessage }];
    setChatHistory(newChatHistory);

    try {
      const currentDateTime = new Date().toLocaleString('bg-BG');

    const systemPrompt = `Ти си интелигентен персонален AI асистент (Джарвис).
      АБСОЛЮТНО ЗАДЪЛЖИТЕЛНО: Винаги отговаряй САМО с валиден JSON обект!

      Днешната дата и час е: ${currentDateTime}.
      
      СТРИКТНИ ПРАВИЛА - ЧЕТИ ВНИМАТЕЛНО:
      1. ПО ПОДРАЗБИРАНЕ: Ако потребителят просто пита нещо, разказва или задава въпрос, ВИНАГИ връщай: {"response": "Отговор на български"}
      
      2. АВТОМЕХАНИК: Ако потребителят пита за проблем с колата, диагноза или грешки, влез в ролята на механик. {"response": "[професионален съвет]"}
      
      3. ГАРАЖ: АКО потребителят каже да запишеш нещо за колата (ВНИМАНИЕ: ако чуеш телефонен номер, НЕ записвай тук!): {"action": "add_to_garage", "entry": "[Кратко описание]"}

      4. ПИСАТЕЛ (КНИГА): Използвай САМО АКО чуеш изрично "добави към романа" или "книгата". {"action": "add_to_book", "refined_text": "[литературен текст]"}
         
      5. ФЕНЕРЧЕ: АКО чуеш "светлина", "светни", "включи/изключи фенерчето": {"action": "toggle_flashlight"}
      6. СПИСЪК ПАЗАРУВАНЕ: АКО чуеш "добави X в списъка": {"action": "add_shopping_items", "items": ["X"]}
      7. ВАЛУТА: АКО чуеш "колко са X евро в лева": {"action": "convert_currency", "amount": 100, "from_currency": "EUR", "to_currency": "BGN"}
      8. КРИПТО: {"action": "crypto_price", "coin": "BTC"}
      9. ПРЕВОДАЧ: {"action": "translate", "translated_text": "преведен текст", "target_lang": "en-US или ru-RU"}
      10. ЛОКАЦИЯ (Къде съм): {"action": "get_location"}
      11. ИЗПРАТИ ЛОКАЦИЯ: {"action": "send_location", "contact": "[име]"}
      
      12. НАБИРАНЕ (ОБАЖДАНЕ): АКО чуеш "набери", "обади се на" или "звънни на" някого (напр. "набери Иван"): {"action": "call", "contact": "[име]"}
      
      13. ВИСОЧИНА: {"action": "get_altitude"}
      14. ВРЕМЕТО: {"action": "check_weather"}
      15. АЛАРМА: {"action": "set_alarm", "time": "HH:MM", "label": "описание"}
      16. НАПОМНЯНЕ: {"action": "schedule_reminder", "title": "описание", "datetime": "YYYY-MM-DDTHH:MM:00"}
      17. БЕЛЕЖКА: {"action": "save_note", "title": "заглавие", "content": "съдържание"}
      18. НАВИГАЦИЯ: {"action": "navigate", "destination": "град или адрес"}
      19. ТЪРСЕНЕ В МРЕЖАТА: Ако те питат за новини, факти или хора. В полето "query" ВИНАГИ ПРЕВЕЖДАЙ ИМЕТО НА АНГЛИЙСКИ. Търси само чистото име: {"action": "search_web", "query": "English Name"}
      
      20. ДОБАВЯНЕ НА КОНТАКТ: АКО чуеш думата "добави" или "запиши" заедно с име и телефонен номер (дори името да съдържа марка кола, напр. "добави Пешо Ауди тел 089..."): {"action": "add_contact", "name": "име", "phone": "телефонен номер"}
	  21. ВИДЕО И МУЗИКА (НОВО!): АКО чуеш "пусни ми", "намери в youtube", "песен на" или "търси видео" (напр. "пусни ми рок музика", "пусни ми Металика"): {"action": "play_youtube", "query": "какво да търся"}`;
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: "POST",
       headers: { "Content-Type": "application/json", "Authorization": `Bearer ${userApiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }, 
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
          ],
          temperature: 0.6 
        })
      });

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content?.trim() || '{}';
      
      let parsedAction = {};
      try { parsedAction = JSON.parse(assistantMessage); } catch (e) { console.error(e); }

      if (parsedAction.response) {
        setChatHistory([...newChatHistory, { role: 'assistant', content: parsedAction.response }]);
        speakText(parsedAction.response, 'bg-BG'); 
      } 
      else if (parsedAction.action) {
        const actionExecuted = await executeAction(parsedAction);
        if (!actionExecuted) setChatHistory([...newChatHistory, { role: 'assistant', content: "Не успях да изпълня командата." }]);
      } 
      else {
        setChatHistory([...newChatHistory, { role: 'assistant', content: "Не успях да разбера тази команда." }]);
      }
    } catch (error) {
      setChatHistory([...newChatHistory, { role: 'assistant', content: 'Грешка при връзката със сървъра.' }]);
    }
    setIsProcessing(false);
  };

  const ensureGpsLocation = async () => {
    if (Capacitor.isNativePlatform()) {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') perm = await Geolocation.requestPermissions();
      if (perm.location !== 'granted') throw new Error("GPS_DENIED");
    }
    return await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
  };

  const executeAction = async (action) => {
    let confirmationMessage = '';
    let speechLang = 'bg-BG'; 

    switch (action.action) {
case 'search_web':
        try {
          // 1. Търсим в АНГЛИЙСКАТА Уикипедия (защото се обновява на секундата) и взимаме масивен текст (extract)
          const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(action.query)}&gsrlimit=1&prop=extracts&exchars=1200&explaintext=1&utf8=&format=json&origin=*`);
          const wikiData = await wikiRes.json();
          
          if (wikiData.query && wikiData.query.pages) {
            const pages = wikiData.query.pages;
            const pageId = Object.keys(pages)[0];
            const extract = pages[pageId].extract;
            const title = pages[pageId].title;

            // 2. Пращаме английския текст на Джарвис да го преведе и осмисли като истински човек
            const secondResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
              body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                  { role: "system", content: "Ти си интелигентен асистент. Твоята задача е да прочетеш този актуален текст от английската Уикипедия, да извлечеш най-важното (ЗАДЪЛЖИТЕЛНО включи дали/кога е починал човекът, ако е споменато!) и да го обобщиш на отличен български език в 2-3 изречения." },
                  { role: "user", content: `Информация за ${title}: ${extract}` }
                ],
                temperature: 0.3
              })
            });
            const secondData = await secondResponse.json();
            confirmationMessage = secondData.choices?.[0]?.message?.content?.trim() || `Намерих информация за ${title}, но не успях да я преведа.`;
          } else {
            confirmationMessage = `Съжалявам, но не успях да намеря информация за "${action.query}" в интернет.`;
          }
        } catch (error) {
          confirmationMessage = "Имам проблем с връзката към интернет търсачката.";
        }
        break;
      case 'add_to_garage':
        try {
          const newGarageEntry = { id: Date.now().toString(), text: action.entry, date: new Date().toLocaleDateString('bg-BG') };
          const updatedGarage = [...garageItems, newGarageEntry];
          setGarageItems(updatedGarage); await storage.set('garageItems', updatedGarage);
          confirmationMessage = `✓ Записах обслужването в Гаража.`;
        } catch (error) { confirmationMessage = "Възникна грешка при записа в гаража."; }
        break;

      case 'toggle_flashlight':
        try {
          if (Capacitor.isNativePlatform()) {
             if (window.plugins && window.plugins.flashlight) {
                 window.plugins.flashlight.toggle();
                 confirmationMessage = "Готово.";
             } else { confirmationMessage = "Плъгинът не е зареден."; }
          } else { confirmationMessage = "Само на реален телефон."; }
        } catch (error) { confirmationMessage = "Не успях да включа фенерчето."; }
        break;

      case 'add_to_book':
        try {
          const newParagraph = { id: Date.now().toString(), text: action.refined_text };
          setBookPages([...bookPages, newParagraph]); await storage.set('bookPages', [...bookPages, newParagraph]);
          confirmationMessage = `✓ Добавих нов абзац.`;
        } catch (error) { confirmationMessage = "Грешка при запазването."; }
        break;

      case 'add_shopping_items':
        try {
          const newItems = action.items.map(itemName => ({ id: Date.now().toString() + Math.random().toString(), name: itemName, isBought: false }));
          setShoppingList([...shoppingList, ...newItems]); await storage.set('shoppingList', [...shoppingList, ...newItems]);
          confirmationMessage = `✓ Добавих ${action.items.length} продукта в списъка.`;
        } catch (error) { confirmationMessage = "Грешка при добавянето."; }
        break;

      case 'convert_currency':
        try {
          const res = await fetch(`https://open.er-api.com/v6/latest/${action.from_currency}`);
          const data = await res.json();
          if (data && data.rates && data.rates[action.to_currency]) {
            confirmationMessage = `${action.amount} ${action.from_currency} са равни на ${(action.amount * data.rates[action.to_currency]).toFixed(2)} ${action.to_currency}.`;
          } else { confirmationMessage = `Не намерих курса.`; }
        } catch (error) { confirmationMessage = `Сървърите за валута не отговарят.`; }
        break;

      case 'crypto_price':
        try {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${action.coin.toUpperCase()}USDT`);
          const data = await res.json();
          if (data && data.price) confirmationMessage = `Цената на ${action.coin.toUpperCase()} е ${parseFloat(data.price).toLocaleString('en-US')} долара.`;
          else confirmationMessage = `Не намерих цена.`;
        } catch (error) { confirmationMessage = `Грешка при крипто сървъра.`; }
        break;

      case 'translate':
        confirmationMessage = action.translated_text; speechLang = action.target_lang || 'bg-BG'; break;

      case 'get_altitude':
        try {
          const coords = await ensureGpsLocation();
          const elRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${coords.coords.latitude}&longitude=${coords.coords.longitude}`);
          const elData = await elRes.json();
          if(elData && elData.elevation && elData.elevation.length > 0) confirmationMessage = `Според сателита се намирате на около ${Math.round(elData.elevation[0])} метра надморска височина.`;
          else confirmationMessage = "Не успях да извлека данните за височината.";
        } catch (error) { confirmationMessage = "Моля, проверете дали GPS-ът ви е включен."; }
        break;

      case 'get_location':
        try {
          const coords = await ensureGpsLocation();
          let addressMsg = "";
          try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.coords.latitude}&lon=${coords.coords.longitude}&accept-language=bg`);
            const geoData = await geoRes.json();
            if (geoData && geoData.display_name) addressMsg = `Вие сте близо до: ${geoData.display_name.split(',').slice(0, 3).join(', ')}. `;
          } catch (e) {}
          confirmationMessage = `${addressMsg}Точните ви GPS координати са: Ширина ${coords.coords.latitude.toFixed(5)}, Дължина ${coords.coords.longitude.toFixed(5)}.`;
        } catch (error) { confirmationMessage = "Моля, проверете дали GPS-ът ви е включен."; }
        break;

      // ОПРАВЕН ЛИНК ЗА ЛОКАЦИЯТА
      case 'send_location':
        try {
          const target = action.contact; 
          if (!target) { confirmationMessage = "Не разбрах на кого да изпратя локацията."; break; }
          let phoneNum = target.replace(/[^0-9+]/g, ''); let targetName = target;
          if (phoneNum.length < 5) {
              const contact = contacts.find(c => c.name.trim().toLowerCase() === target.trim().toLowerCase());
              if (contact && contact.phone) { phoneNum = contact.phone; targetName = contact.name; } 
              else { confirmationMessage = `❌ Не намерих номер за "${target}".`; break; }
          }
          const coords = await ensureGpsLocation();
          const mapLink = `https://maps.google.com/?q=${coords.coords.latitude},${coords.coords.longitude}`;
          const smsBody = `Здравей! Намирам се точно тук: ${mapLink}`;
          if (Capacitor.isNativePlatform()) {
            await IntentLauncher.startActivityAsync({ action: 'android.intent.action.SENDTO', data: `smsto:${phoneNum}`, extra: { 'sms_body': smsBody } });
          } else { window.location.href = `sms:${phoneNum}?body=${encodeURIComponent(smsBody)}`; }
          confirmationMessage = `Подготвям SMS с вашата локация до ${targetName}.`;
        } catch (error) { confirmationMessage = "Възникна грешка. Моля, проверете GPS-а си."; }
        break;

      // НОВА НАВИГАЦИЯ С WAZE 🚗🗺️
      case 'navigate':
        try {
         const wazeUrl = `waze://?q=${encodeURIComponent(action.destination)}&navigate=yes`;
          if (Capacitor.isNativePlatform()) {
            await IntentLauncher.startActivityAsync({ action: 'android.intent.action.VIEW', data: wazeUrl });
          } else {
            window.open(wazeUrl, '_blank');
          }
          confirmationMessage = `🗺️ Отварям Waze за маршрут до ${action.destination}.`;
        } catch (error) { confirmationMessage = "Възникна проблем при отварянето на Waze."; }
        break;
      // 🎵 НОВО: ОТВАРЯНЕ НА YOUTUBE
      case 'play_youtube':
        try {
          const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(action.query)}`;
          if (Capacitor.isNativePlatform()) {
            await IntentLauncher.startActivityAsync({ action: 'android.intent.action.VIEW', data: ytUrl });
          } else {
            window.open(ytUrl, '_blank');
          }
          confirmationMessage = `🎵 Отварям YouTube за: ${action.query}`;
        } catch (error) {
          confirmationMessage = "Възникна проблем при отварянето на YouTube.";
        }
        break;
    // 🌤️ ПОПРАВЕНО ВРЕМЕ (С детайли)
      case 'check_weather':
        try {
          const locWeather = await Geolocation.getCurrentPosition();
          const lat = locWeather.coords.latitude;
          const lon = locWeather.coords.longitude;
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
          const weatherData = await weatherRes.json();
          const current = weatherData.current_weather;
          
          // Превеждаме кода на времето на български
          let condition = "ясно";
          if (current.weathercode >= 1 && current.weathercode <= 3) condition = "предимно облачно";
          else if (current.weathercode >= 51 && current.weathercode <= 67) condition = "дъждовно";
          else if (current.weathercode >= 71 && current.weathercode <= 77) condition = "снежно";
          else if (current.weathercode >= 95) condition = "с гръмотевици";
          
          confirmationMessage = `В момента времето навън е ${condition}, температурата е ${current.temperature} градуса, а скоростта на вятъра е ${current.windspeed} километра в час.`;
        } catch (error) {
          confirmationMessage = "Не успях да проверя времето. Моля, проверете GPS-а и интернета си.";
        }
        break;

      case 'set_alarm':
        try {
          const newAlarm = { id: Date.now().toString(), time: action.time, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], enabled: true, label: action.label || 'Аларма' };
          setAlarms([...alarms, newAlarm]); 
          await storage.set('alarms', [...alarms, newAlarm]);
          
          if (Capacitor.isNativePlatform()) {
            const [hours, minutes] = action.time.split(':');
            await IntentLauncher.startActivityAsync({ 
              action: 'android.intent.action.SET_ALARM', 
              extra: { 
                'android.intent.extra.alarm.HOUR': parseInt(hours, 10), 
                'android.intent.extra.alarm.MINUTES': parseInt(minutes, 10), 
                'android.intent.extra.alarm.MESSAGE': newAlarm.label, 
                'android.intent.extra.alarm.SKIP_UI': true 
              } 
            });
          }
          confirmationMessage = `✓ Настроих аларма за ${action.time}`; 
        } catch (error) {
           confirmationMessage = `✓ Запазих алармата за ${action.time}.`;
        }
        break;

      case 'schedule_reminder':
        try {
          const reminderDate = new Date(action.datetime);
          if (isNaN(reminderDate.getTime())) { confirmationMessage = "Не разбрах датата."; break; }
          const beginTime = reminderDate.getTime();
          const endTime = beginTime + (60 * 60 * 1000); 
          const readableDate = reminderDate.toLocaleString('bg-BG', { day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' });
          if (Capacitor.isNativePlatform()) {
            await IntentLauncher.startActivityAsync({ action: 'android.intent.action.INSERT', data: 'content://com.android.calendar/events', extra: { 'title': action.title, 'beginTime': beginTime, 'endTime': endTime } });
          }
          const newReminder = { id: Date.now().toString(), title: action.title, date: readableDate, isNote: false };
          setReminders([...reminders, newReminder]); await storage.set('reminders', [...reminders, newReminder]);
          confirmationMessage = `✓ Отварям календара за ${readableDate}.`;
        } catch (error) { confirmationMessage = "Грешка с календара."; }
        break;

     // 📝 ПОПРАВЕНИ БЕЛЕЖКИ
      case 'save_note':
        const newNote = { 
          id: Date.now().toString(), 
          title: action.title || 'Бележка', 
          content: action.content || '', 
          date: new Date().toLocaleDateString('bg-BG') 
        };
        const updatedNotes = [...notes, newNote];
        setNotes(updatedNotes);
        await storage.set('notes', updatedNotes);
        confirmationMessage = `📝 Готово! Записах бележката: "${action.title}".`;
        break;
		
// 📞 ПОПРАВЕНО НАБИРАНЕ (Гъвкаво търсене)
      case 'call':
        const searchName = action.contact?.toLowerCase().replace(/\s+/g, '');
        const contact = contacts.find(c => {
          // Махаме интервалите и уеднаквяваме буквите, за да няма значение как е написано/прочетено
          const dbName = c.name.toLowerCase().replace(/\s+/g, '');
          return dbName.includes(searchName) || searchName.includes(dbName);
        });

        if (contact && contact.phone) { 
          confirmationMessage = `📞 Набирам ${contact.name}...`; 
          // Изчистваме всички интервали от номера (0888 785 852 става 0888785852)
          const cleanPhone = contact.phone.replace(/[^0-9+]/g, '');
          window.location.href = `tel:${cleanPhone}`; 
        } 
        else { 
          confirmationMessage = `❌ Не намерих номер за ${action.contact}.`; 
        }
        break;

      // 📝 ПОПРАВЕНО ДОБАВЯНЕ НА КОНТАКТ
      case 'add_contact':
        // Изчистваме номера още при запазването му
        const cleanNumber = (action.phone || '').replace(/[^0-9+]/g, '');
        const newContact = { id: Date.now().toString(), name: action.name, phone: cleanNumber };
        setContacts([...contacts, newContact]); 
        await storage.set('contacts', [...contacts, newContact]);
        confirmationMessage = `✓ Добавих ${action.name} в контактите.`; 
        break;
    }

    if (confirmationMessage) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: confirmationMessage }]);
      speakText(confirmationMessage, speechLang); 
      return true;
    }
    return false;
  };

  const downloadAndClearBook = async () => {
    if (bookPages.length === 0) { alert("Романът ви е празен!"); return; }
    const fullText = bookPages.map(page => page.text).join('\n\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Роман_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setBookPages([]); await storage.set('bookPages', []);
    alert("Книгата е изтеглена, а паметта изчистена!");
  };

  const deleteBookPage = async (id) => { const updated = bookPages.filter(p => p.id !== id); setBookPages(updated); await storage.set('bookPages', updated); };
  const deleteAlarm = async (id) => { const updated = alarms.filter(a => a.id !== id); setAlarms(updated); await storage.set('alarms', updated); };
  const deleteContact = async (id) => { const updated = contacts.filter(c => c.id !== id); setContacts(updated); await storage.set('contacts', updated); };
  const deleteReminder = async (id) => { const updated = reminders.filter(r => r.id !== id); setReminders(updated); await storage.set('reminders', updated); };
  const toggleShoppingItem = async (id) => { const updated = shoppingList.map(item => item.id === id ? { ...item, isBought: !item.isBought } : item); setShoppingList(updated); await storage.set('shoppingList', updated); };
  const deleteShoppingItem = async (id) => { const updated = shoppingList.filter(item => item.id !== id); setShoppingList(updated); await storage.set('shoppingList', updated); };
  const deleteGarageItem = async (id) => { const updated = garageItems.filter(item => item.id !== id); setGarageItems(updated); await storage.set('garageItems', updated); };
  const handleCallContact = (contact) => { if (!contact.phone || contact.phone.trim() === '') alert(`Няма номер за ${contact.name}!`); else window.location.href = `tel:${contact.phone}`; };
  const handleAddPhone = (contactId, contactName) => { setPhonePrompt({ show: true, contactId, contactName, tempPhone: '' }); };
  const submitPhone = async () => { if (phonePrompt.tempPhone.trim()) { const updated = contacts.map(c => c.id === phonePrompt.contactId ? { ...c, phone: phonePrompt.tempPhone } : c); setContacts(updated); await storage.set('contacts', updated); } setPhonePrompt({ show: false, contactId: null, contactName: '', tempPhone: '' }); };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%)', fontFamily: "'Outfit', sans-serif", display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ background: '#1e293b', padding: '1.2rem 1.5rem', borderBottom: '4px solid #ff6b35', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>AI Асистент</h1>
          <span style={{ background: '#ff6b35', color: '#fff', padding: '3px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1px' }}>PRO</span>
        </div>
      </div>

      <div style={{ background: '#fff', margin: '1rem', padding: '1.2rem', borderRadius: '16px', border: '3px solid #1e293b', boxShadow: '4px 4px 0 #ff6b35' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div onClick={startListening} style={{ width: '56px', height: '56px', background: isListening ? '#ef4444' : 'linear-gradient(135deg, #ff6b35, #ff8c61)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #1e293b', cursor: 'pointer', boxShadow: isListening ? '0 0 20px #ef4444' : 'none' }}>
              <Mic size={28} color="#fff" />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#1e293b' }}>
              {isListening ? 'Слушам ви...' : 'Гласова команда'}
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <input type="text" value={voiceInput} onChange={(e) => setVoiceInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && processVoiceCommand()} placeholder="Говорете с Джарвис..." style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem', border: '3px solid #1e293b', borderRadius: '12px', outline: 'none', boxSizing: 'border-box' }} />
            <button id="send-btn" onClick={() => { if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); processVoiceCommand(); }} disabled={isProcessing} style={{ width: '100%', padding: '1.2rem', background: '#10b981', color: '#fff', border: '3px solid #1e293b', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer' }}>
              {isProcessing ? 'Мисли...' : 'ИЗПРАТИ'}
            </button>
          </div>
        </div>
        {chatHistory.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>ИСТОРИЯ</span>
              <button onClick={clearChat} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><X size={14} /> Изчисти</button>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '2px solid #e2e8f0' }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: msg.role === 'user' ? '#fff' : '#e0f2fe', borderLeft: `4px solid ${msg.role === 'user' ? '#ff6b35' : '#10b981'}` }}>
                  <strong>{msg.role === 'user' ? 'Вие' : 'AI'}:</strong> {msg.content}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {['dashboard', 'book', 'garage'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.6rem', background: activeTab === tab ? '#ff6b35' : '#fff', color: activeTab === tab ? '#fff' : '#1e293b', border: '2px solid #1e293b', borderRadius: '10px', fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', transition: '0.2s', fontSize: '0.9rem' }}>
              {tab === 'dashboard' ? 'Табло' : tab === 'book' ? 'Роман' : tab === 'garage' ? 'Гараж' : tab}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {['shopping', 'alarms', 'contacts'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.6rem', background: activeTab === tab ? '#ff6b35' : '#fff', color: activeTab === tab ? '#fff' : '#1e293b', border: '2px solid #1e293b', borderRadius: '10px', fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', transition: '0.2s', fontSize: '0.9rem' }}>
              {tab === 'shopping' ? 'Пазар' : tab === 'alarms' ? 'Аларми' : tab === 'contacts' ? 'Контакти' : tab}
            </button>
          ))}
        </div>
      </div>

    <div style={{ padding: '0 1rem', flex: 1 }}>
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* 1. МРЕЖА С 4-ТЕ КАРТИ (Сервиз, Страници, Покупки, Аларми) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <StatCard icon={Car} title="Сервиз" value={garageItems.length} color="#f59e0b" />
              <StatCard icon={PenTool} title="Страници" value={bookPages.length} color="#ec4899" />
              <StatCard icon={ShoppingCart} title="Покупки" value={shoppingList.filter(i => !i.isBought).length} color="#8b5cf6" />
              
              <StatCard 
                icon={() => (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '1.5rem', height: '1.5rem' }}>
                    <circle cx="12" cy="13" r="8"></circle>
                    <polyline points="12 9 12 13 14 15"></polyline>
                    <line x1="16.51" y1="7.35" x2="18.9" y2="4.96"></line>
                    <line x1="7.49" y1="7.35" x2="5.1" y2="4.96"></line>
                  </svg>
                )} 
                title="Аларми" 
                value={alarms.length} 
                color="#ef4444" 
              />
            </div>

            {/* 2. ШИРОК БУТОН ЗА БЕЛЕЖНИК (Застава перфектно под мрежата) */}
            <div 
              onClick={() => setActiveTab('notes')}
              style={{ background: '#fff', padding: '1.5rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', borderLeft: `5px solid #f59e0b` }}
            >
              <span style={{ fontSize: '2rem' }}>📝</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'bold' }}>БЕЛЕЖНИК</div>
                <div style={{ color: '#1e293b', fontSize: '1.5rem', fontWeight: '800' }}>{notes.length} бележки</div>
              </div>
            </div>

          </div>
        )}
        {activeTab === 'garage' && (
          <div>
            <h3 style={{marginTop: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Car size={24} color="#f59e0b" /> Моят Гараж</h3>
            {garageItems.length === 0 && <p style={{color: '#64748b'}}>Гаражът ви е празен. Кажете на Джарвис да запише сервизно обслужване или ремонт!</p>}
            {garageItems.map(item => (
              <div key={item.id} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '2px solid #1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '3px 3px 0 #f59e0b' }}>
                <div><div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>📅 {item.date}</div><div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{item.text}</div></div>
                <button onClick={() => deleteGarageItem(item.id)} style={{ padding: '0.5rem', background: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}><X size={16} /></button>
              </div>
            ))}
          </div>
        )}
        {/* 📝 ЕКРАН БЕЛЕЖНИК */}
      {activeTab === 'notes' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#fff', borderRadius: '15px' }}>
            <button onClick={() => setActiveTab('dashboard')} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: 'bold' }}>🔙 Назад</button>
            <h2 style={{ margin: 0 }}>Личен Бележник</h2>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {notes.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b' }}>Нямате записани бележки. Кажете "Джарвис, запиши бележка..."</p>
            ) : (
              notes.map(note => (
                <div key={note.id} style={{ background: '#fff', padding: '1rem', borderRadius: '15px', borderLeft: '4px solid #f59e0b', position: 'relative' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>{note.title}</h3>
                  <p style={{ margin: '0 0 1rem 0', color: '#475569', whiteSpace: 'pre-wrap' }}>{note.content}</p>
                  <small style={{ color: '#94a3b8' }}>📅 {note.date}</small>
                  
                  <button 
                    onClick={async () => {
                      const newNotes = notes.filter(n => n.id !== note.id);
                      setNotes(newNotes);
                      await storage.set('notes', newNotes);
                    }}
                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.5rem', borderRadius: '10px' }}
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
        {activeTab === 'book' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><PenTool size={24} color="#ec4899" /> Моят Роман</h3>
              <button onClick={downloadAndClearBook} style={{ padding: '0.5rem 1rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><Download size={16} /> Изтегли</button>
            </div>
            {bookPages.length === 0 && <p style={{color: '#64748b'}}>Книгата е празна. Кажете: "Джарвис, добави към романа..."</p>}
            {bookPages.map((page, index) => (
              <div key={page.id} style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '2px solid #e2e8f0', marginBottom: '1rem', position: 'relative' }}>
                <button onClick={() => deleteBookPage(page.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
                <div style={{ fontSize: '0.8rem', color: '#ec4899', fontWeight: 'bold', marginBottom: '0.5rem' }}>АБЗАЦ {index + 1}</div>
                <div style={{ fontSize: '1.1rem', color: '#334155', lineHeight: '1.6', textAlign: 'justify' }}>{page.text}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'shopping' && (
          <div>
            <h3 style={{marginTop: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><ShoppingCart size={24} color="#ff6b35" /> Списък за пазаруване</h3>
            {shoppingList.map(item => (
              <div key={item.id} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '2px solid #1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', opacity: item.isBought ? 0.7 : 1 }}>
                <div onClick={() => toggleShoppingItem(item.id)} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '2px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: item.isBought ? '#10b981' : 'transparent' }}>{item.isBought && <Check size={18} color="#fff" />}</div>
                <div style={{ flex: 1, fontSize: '1.2rem', fontWeight: 600, textDecoration: item.isBought ? 'line-through' : 'none', color: item.isBought ? '#94a3b8' : '#1e293b', cursor: 'pointer' }} onClick={() => toggleShoppingItem(item.id)}>{item.name}</div>
                <button onClick={() => deleteShoppingItem(item.id)} style={{ padding: '0.5rem', background: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'alarms' && (
          <div>
            {alarms.map(alarm => (
              <div key={alarm.id} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', border: '2px solid #1e293b', display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}><div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{alarm.time}</div><button onClick={() => deleteAlarm(alarm.id)} style={{ padding: '0.5rem', background: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>Изтрий</button></div>
            ))}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div>
            {contacts.map(contact => (
               <div key={contact.id} style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '2px solid #1e293b', marginBottom: '1rem', boxShadow: '4px 4px 0 #3b82f6', position: 'relative' }}>
                 <button onClick={() => deleteContact(contact.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
                 <div onClick={() => handleCallContact(contact)} style={{ cursor: 'pointer' }}><div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{contact.name}</div><div style={{ fontSize: '0.9rem', color: '#64748b' }}>{contact.phone || 'Няма въведен номер'}</div></div>
                 {(!contact.phone || contact.phone.trim() === '') && (<button onClick={(e) => { e.stopPropagation(); handleAddPhone(contact.id, contact.name); }} style={{ padding: '0.5rem 1rem', marginTop: '0.5rem', background: '#e2e8f0', border: '2px solid #1e293b', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Добави телефонен номер</button>)}
               </div>
            ))}
          </div>
        )}
      </div>

      {phonePrompt.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', border: '3px solid #1e293b', width: '85%', maxWidth: '400px', boxShadow: '8px 8px 0 #10b981' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.2rem' }}>Въведете номер за <span style={{color: '#ff6b35'}}>{phonePrompt.contactName}</span></h3>
            <input type="number" value={phonePrompt.tempPhone} onChange={(e) => setPhonePrompt({ ...phonePrompt, tempPhone: e.target.value })} style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem', border: '2px solid #1e293b', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setPhonePrompt({ show: false, contactId: null, contactName: '', tempPhone: '' })} style={{ padding: '0.75rem 1.5rem', border: '2px solid #1e293b', borderRadius: '8px', background: '#f1f5f9', fontWeight: 'bold', cursor: 'pointer' }}>Отказ</button>
              <button onClick={submitPhone} style={{ padding: '0.75rem 1.5rem', border: '2px solid #1e293b', borderRadius: '8px', background: '#10b981', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>Запази</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '13px', fontWeight: 'bold', marginTop: 'auto' }}>
        Created by Lyudmil Tonchev
      </div>
	  {/* 🚀 ЕКРАН ЗА ПЪРВОНАЧАЛНА НАСТРОЙКА НА API КЛЮЧ */}
      {showApiSetup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(30, 41, 59, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '4px solid #ff6b35', width: '100%', maxWidth: '450px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.8rem', color: '#1e293b', textAlign: 'center' }}>Добре дошли в Джарвис! 🤖</h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: '1.5', textAlign: 'justify' }}>
              За да използвате изкуствения интелект безплатно и неограничено, трябва да въведете свой личен <strong>Groq API ключ</strong>.
            </p>
            <ol style={{ color: '#1e293b', fontSize: '0.95rem', paddingLeft: '1.2rem', marginBottom: '1.5rem' }}>
              <li style={{ marginBottom: '8px' }}>Отидете на <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontWeight: 'bold' }}>console.groq.com</a> (напълно безплатно).</li>
              <li style={{ marginBottom: '8px' }}>Направете си регистрация.</li>
              <li>Натиснете "Create API Key" и поставете ключа тук:</li>
            </ol>
            
            <input 
              type="password" 
              placeholder="gsk_..." 
              value={userApiKey} 
              onChange={(e) => setUserApiKey(e.target.value)} 
              style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem', border: '2px solid #1e293b', borderRadius: '10px', fontSize: '1.1rem', boxSizing: 'border-box' }} 
            />
            
            <button 
              onClick={async () => {
                if (userApiKey.trim().startsWith('gsk_')) {
                  await storage.set('user_api_key', userApiKey.trim());
                  setShowApiSetup(false);
                } else {
                  alert("Невалиден ключ. Трябва да започва с 'gsk_'");
                }
              }} 
              style={{ width: '100%', padding: '1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 0 #059669' }}
            >
              ЗАПАЗИ И СТАРТИРАЙ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, title, value, color }) {
  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '2px solid #1e293b', boxShadow: `4px 4px 0 ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '56px', height: '56px', background: color, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={28} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'bold' }}>{title}</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
        </div>
      </div>
	  
    </div>
  );
}