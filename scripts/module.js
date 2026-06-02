/**
 * Warhammer: The Old World to D&D 5e
 * Главный скрипт инициализации модуля для Foundry VTT v14 / D&D 5.3.3
 */

const MODULE_ID = "warhammer-to-dnd";

class WarhammerToDnD {
  /**
   * Кастомный логгер для модуля
   * Добавляет префикс для удобной отладки в консоли (F12)
   */
  static log(force, ...args) {
    const shouldLog = force || game.modules.get('_dev-mode')?.api?.getPackageDebugValue(MODULE_ID);
    if (shouldLog) {
      console.log(`%c[${MODULE_ID}]`, "color: #8a1f1f; font-weight: bold;", ...args);
    }
  }

  /**
   * Хук 'init' запускается самым первым, когда ядро Foundry инициализируется.
   * Отличное место для регистрации настроек, кастомных листов и глобального API.
   */
  static init() {
    this.log(true, "Инициализация модуля Warhammer: The Old World...");

    // 1. Регистрация настроек модуля
    // this.registerSettings();

    // 2. Публикация API модуля (чтобы другие скрипты/макросы могли к нему обращаться)
    const module = game.modules.get(MODULE_ID);
    module.api = {
      // Здесь в будущем можно добавить полезные функции, например:
      // spawnChaosDemon: () => { ... }
      version: module.version
    };
  }

  /**
   * Хук 'setup' запускается, когда все базовые данные инициализированы, 
   * но до того, как они отрисованы (Canvas еще не готов).
   */
  static setup() {
    this.log(true, "Подготовка окружения (Setup)...");
  }

  /**
   * Хук 'ready' запускается, когда мир полностью загружен, 
   * все компендиумы доступны, а Canvas (сцена) отрисован.
   */
  static ready() {
    this.log(true, "Мир загружен. За Императора / Темных Богов!");

    // Проверка версии D&D 5e (полезно для обратной совместимости)
    const dndVersion = game.system.version;
    this.log(false, `Обнаружена система D&D 5e версии: ${dndVersion}`);

    if (foundry.utils.isNewerVersion("5.3.3", dndVersion)) {
      ui.notifications.warn(`[${MODULE_ID}] Этот модуль оптимизирован для D&D 5.3.3+. Текущая версия: ${dndVersion}`);
    }
  }

  /**
   * Регистрация пользовательских настроек (Settings) в меню конфигурации Foundry
   */
  static registerSettings() {
    // Пример глобальной настройки (только для GM)
    game.settings.register(MODULE_ID, "enableGrimdarkRules", {
      name: "WARHAMMER.Settings.Grimdark.Name",      // Ключ локализации из ru.json / en.json
      hint: "WARHAMMER.Settings.Grimdark.Hint",      // Ключ локализации
      scope: "world",                                // 'world' (для GM) или 'client' (для каждого игрока)
      config: true,                                  // Показывать в меню настроек
      type: Boolean,
      default: false,
      onChange: (value) => this.log(true, `Grimdark Rules changed to: ${value}`)
    });
  }
}

// ================================
// РЕГИСТРАЦИЯ ХУКОВ (HOOKS)
// ================================
Hooks.once("init", () => WarhammerToDnD.init());
Hooks.once("setup", () => WarhammerToDnD.setup());
Hooks.once("ready", () => WarhammerToDnD.ready());