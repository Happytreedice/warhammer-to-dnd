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
   * Хук 'init' - регистрация настроек
   */
  static init() {
    this.log(true, "Инициализация модуля Warhammer: The Old World...");

    // Регистрация настроек (включая скрытую настройку версии)
    this.registerSettings();

    const module = game.modules.get(MODULE_ID);
    module.api = {
      version: module.version
    };
  }

  static setup() {
    this.log(true, "Подготовка окружения (Setup)...");
  }

  /**
   * Хук 'ready' - проверка версии и запуск миграций
   */
  static async ready() {
    this.log(true, "Мир загружен. Выполняем проверку версии D&D и миграцию структуры папок компендиумов...");

    const dndVersion = game.system.version;
    if (foundry.utils.isNewerVersion("5.3.3", dndVersion)) {
      ui.notifications.warn(`[${MODULE_ID}] Этот модуль оптимизирован для D&D 5.3.3+. Текущая версия: ${dndVersion}`);
    }

    // Запускаем проверку версии и реструктуризацию ТОЛЬКО для GM
    if (game.user.isGM) {
      await this.checkVersionAndMigrate();
    }
  }

  /**
   * Проверка версии модуля и запуск пересоздания папок
   */
  static async checkVersionAndMigrate() {
    const module = game.modules.get(MODULE_ID);
    const currentVersion = module.version;
    
    // Используем скрытую настройку как "флаг мира" для хранения версии модуля в БД мира
    const storedVersion = game.settings.get(MODULE_ID, "moduleVersion");

    // Если версия в настройках меньше актуальной (или это первый запуск "0.0.0")
    if (foundry.utils.isNewerVersion(currentVersion, storedVersion)) {
      this.log(true, `Обнаружена новая версия модуля: ${currentVersion} (была: ${storedVersion}). Запуск обновления...`);
      
      try {
        await this.rebuildCompendiumFolders();
        // Записываем новую версию во флаги мира (настройки)
        await game.settings.set(MODULE_ID, "moduleVersion", currentVersion);
        ui.notifications.info(`[${MODULE_ID}] Структура компендиумов успешно обновлена до версии ${currentVersion}.`);
      } catch (error) {
        console.error(`[${MODULE_ID}] Ошибка при обновлении структуры компендиумов:`, error);
        ui.notifications.error(`[${MODULE_ID}] Ошибка при обновлении. Подробности в консоли (F12).`);
      }
    }
  }

  /**
   * Ресет и создание структуры папок для компендиумов в боковом меню
   */
  static async rebuildCompendiumFolders() {
    this.log(false, "Очистка старой структуры папок...");

    // 1. Ищем все папки компендиумов, которые были созданы этим модулем (определяем по нашему флагу)
    const existingFolders = game.folders.filter(f => f.type === "Compendium" && f.flags[MODULE_ID]?.isModuleFolder);
    
    // 2. Удаляем старые папки модуля (ресетим структуру). Сами паки при этом не удаляются.
    for (let folder of existingFolders) {
      await folder.delete();
    }

    this.log(false, "Создание новой структуры...");

    // 3. Создаем главную (корневую) папку модуля
    const rootFolder = await Folder.create({
      name: "Warhammer: The Old World",
      type: "Compendium",
      color: "#8a1f1f",
      flags: { [MODULE_ID]: { isModuleFolder: true } } // Вешаем флаг, чтобы при следующем обновлении найти её для удаления
    });

    // 4. Привязываем конкретные компендиумы из твоего module.json к новой папке
    const packsToMove = [
      "warhammer-actors",
      "warhammer-items"
    ];

    for (let packName of packsToMove) {
      // Ищем паки по ключу: id_модуля.название_пака
      const pack = game.packs.get(`${MODULE_ID}.${packName}`);
      if (pack) {
        await pack.setFolder(rootFolder);
        this.log(false, `Компендиум [${pack.metadata.label}] перемещен в папку [${rootFolder.name}]`);
      } else {
        this.log(true, `Внимание: Компендиум ${packName} не найден! Убедитесь, что название совпадает с module.json.`);
      }
    }
  }

  static registerSettings() {
    // Скрытая настройка для хранения версии модуля в текущем мире
    game.settings.register(MODULE_ID, "moduleVersion", {
      name: "Module Version",
      hint: "Хранит текущую версию модуля для отслеживания обновлений.",
      scope: "world",
      config: false, // НЕ показывать в меню настроек
      type: String,
      default: "1.0.0"
    });

    // Твоя настройка
    game.settings.register(MODULE_ID, "enableGrimdarkRules", {
      name: "WARHAMMER.Settings.Grimdark.Name",
      hint: "WARHAMMER.Settings.Grimdark.Hint",
      scope: "world",
      config: false,
      type: Boolean,
      default: true,
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