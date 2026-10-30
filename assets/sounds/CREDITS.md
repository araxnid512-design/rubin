# Звуки оружия — авторы и лицензии

Настоящие записи выстрелов, перезарядки и взрыва взяты из набора **CC-Sounds** проекта
[Fris0uman/cdda-soundpacks](https://github.com/Fris0uman/cdda-soundpacks) (сборник — CC BY-SA 4.0),
у каждого файла свой автор и лицензия. Для игры записи обрезаны, выровнены по громкости и
перекодированы в MP3 скриптом `scripts/build-sounds.mjs`; изменённые файлы распространяются на тех же условиях,
что и исходники (CC BY / CC0, в составе сборника — CC BY-SA 4.0).

| Файл | Что звучит в игре | Исходник | Автор | Лицензия | Ссылка |
|---|---|---|---|---|---|
| pistol.mp3 | ПМ, «Вектор» (выше тоном), ВСС (глухой хлопок) | handgun_1.ogg | GoodSoundForYou | CC BY 3.0 | https://soundbible.com/2120-9mm-Gunshot.html |
| shotgun.mp3 | МР-133, обрез ИЖ-43 | shotgun_1.ogg | MATRIXXX_ | CC BY 4.0 | https://freesound.org/people/MATRIXXX_/sounds/473846/ |
| ak1.mp3, ak2.mp3, ak3.mp3 | АКС-74У, АК-74, АК-47 (ниже тоном) | 556_auto_rifle_shot_01–03.ogg | DoctorBoomstick | CC BY 4.0 | записано автором на стрельбище (Sig Sauer MCX Spear LT), см. credits.md набора |
| mg.mp3 | ПКМ | machinegun_1.ogg | WEL | CC BY 3.0 | https://soundbible.com/1575-High-Definition-Machine-Gun.html |
| svd.mp3 | СВД | genericgun_1.ogg | battlestar10 | CC BY 3.0 | https://soundbible.com/1666-M1-Garand-Gunfire.html |
| casing1.mp3, casing2.mp3 | гильза падает на землю | brass_eject.ogg | FST180081 | CC BY 4.0 | https://freesound.org/people/FST180081/sounds/441806/ |
| dry.mp3 | сухой щелчок пустого оружия, затвор ВСС | empty_1.ogg | Rolly-SFX | CC0 1.0 | https://freesound.org/people/Rolly-SFX/sounds/528708/ |
| reload_pistol.mp3 | перезарядка пистолета | pocket_pistol_load_01.ogg | DoctorBoomstick | CC BY 4.0 | записано автором (Beretta M1934), см. credits.md набора |
| reload_rifle.mp3 | смена магазина автомата и винтовки | default.ogg (reload) | magnuswaker | CC0 1.0 | https://freesound.org/people/magnuswaker/sounds/530225/ |
| bolt.mp3 | взвод затвора после смены магазина, цевьё помпы МР-133 | bolt_action_rifle_load_01.ogg | DoctorBoomstick | CC BY 4.0 | записано автором (IG1889), см. credits.md набора |
| shell.mp3 | патрон 12 калибра в патронник / трубку | shell_load_01.ogg | DoctorBoomstick | CC BY 4.0 | записано автором (Browning Auto 5), см. credits.md набора |
| explosion.mp3 | взрыв гранаты | explosion_huge_1.ogg | unfa | CC0 1.0 | https://freesound.org/people/unfa/sounds/352143/ |

Остальные звуки игры (рык, удары, шаги, интерфейс) синтезируются в браузере (`game/audio.js`);
если файл не загрузился, вместо записи тоже звучит синтез.
