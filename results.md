## Баланс на старте: 4185.0
```
Credits: 4185
Membership: premium
Subscription: premium (monthly)
```

### g98_xd_surgery_fetch: python3 tools/tripo/fetch_task.py 5eab0c22-248e-45e3-b85c-19ffdcc9daf2 xd_surgery
код 0, 1 с, кредитов 0.0
```
ключи ссылок: ['model_url']
скачано: out/xd_surgery.glb 2851500 байт
```

### g98_xd_crate1: python3 tools/tripo/chain.py --id xd_crate1 --faces 6000 --tex detailed --geo detailed --pbr --prompt Military supply crate, olive green painted steel with a ribbed lid, wide bright green vertical stripe across the lid and the front, two steel latches on the front, side handles, a stenciled green access card emblem with wireles
код 0, 168 с, кредитов 55.0
```
$ tripo generate text Military supply crate, olive green painted steel with a ribbed lid, wide brig... --face-limit 6000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/xd_crate1.glb
OK: Task created: 45b16fd6-620b-4bd0-a1d0-948d19271bcc
OK: Generation complete
OK: Downloaded: out/xd_crate1.glb (5.0 MB)
$ tripo project list --size 1 --output-format json
{"total":369,"projects":[{"project_id":"58f6395e-fe9a-42db-980c-cb2b6759af86","project_name":"military supply crate 3d model","operator":{"operator_id":"45b16fd6-620b-4bd0-a1d0-948d19271bcc","status":"success","type":"text_to_model","created_at":1795712590}}]}
ПРОЕКТ xd_crate1: 58f6395e-fe9a-42db-980c-cb2b6759af86
{"id": "xd_crate1", "steps": [["generate", 0]], "pid": "58f6395e-fe9a-42db-980c-cb2b6759af86"}
```

### g98_xd_crate2: python3 tools/tripo/chain.py --id xd_crate2 --faces 6000 --tex detailed --geo detailed --pbr --prompt Heavy dark gunmetal steel military crate with yellow painted reinforced corner plates, wide yellow stripe across the lid and the front, yellow and black hazard stripes at the bottom of the front panel, a stenciled yellow access
код 0, 169 с, кредитов 55.0
```
$ tripo generate text Heavy dark gunmetal steel military crate with yellow painted reinforced corne... --face-limit 6000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/xd_crate2.glb
OK: Task created: 5d05b9a0-c510-43ac-b36c-c98757765f19
OK: Generation complete
OK: Downloaded: out/xd_crate2.glb (6.1 MB)
$ tripo project list --size 1 --output-format json
{"total":370,"projects":[{"project_id":"06bf7825-cc4e-43ae-a4a3-ba8ae5a36f4b","project_name":"military steel crate 3d model","operator":{"operator_id":"5d05b9a0-c510-43ac-b36c-c98757765f19","status":"success","type":"text_to_model","created_at":1795712761}}]}
ПРОЕКТ xd_crate2: 06bf7825-cc4e-43ae-a4a3-ba8ae5a36f4b
{"id": "xd_crate2", "steps": [["generate", 0]], "pid": "06bf7825-cc4e-43ae-a4a3-ba8ae5a36f4b"}
```

### g98_xd_crate3: python3 tools/tripo/chain.py --id xd_crate3 --faces 6000 --tex detailed --geo detailed --pbr --prompt Heavy armored black steel containment crate with dark red painted panels and a wide red stripe across the lid, glowing red indicator lights on the latches, a white biohazard symbol on the side, a stenciled red access card emble
код 0, 162 с, кредитов 55.0
```
$ tripo generate text Heavy armored black steel containment crate with dark red painted panels and ... --face-limit 6000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/xd_crate3.glb
OK: Task created: 1b96d187-0440-4951-b3b0-825adbfa175e
OK: Generation complete
OK: Downloaded: out/xd_crate3.glb (5.0 MB)
$ tripo project list --size 1 --output-format json
{"total":371,"projects":[{"project_id":"810fe6e2-1720-4356-8fae-86a0f390f65d","project_name":"armored containment crate 3d model","operator":{"operator_id":"1b96d187-0440-4951-b3b0-825adbfa175e","status":"success","type":"text_to_model","created_at":1795712933}}]}
ПРОЕКТ xd_crate3: 810fe6e2-1720-4356-8fae-86a0f390f65d
{"id": "xd_crate3", "steps": [["generate", 0]], "pid": "810fe6e2-1720-4356-8fae-86a0f390f65d"}
```

### g98_xd_generator: python3 tools/tripo/chain.py --id xd_generator --faces 5000 --prompt Large industrial diesel generator unit on a skid with an exhaust pipe and a control panel. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 108 с, кредитов 25.0
```
$ tripo generate text Large industrial diesel generator unit on a skid with an exhaust pipe and a c... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_generator.glb
OK: Task created: 1073444e-d7fd-4a01-b8d8-bc6f0f2c9b9a
OK: Generation complete
OK: Downloaded: out/xd_generator.glb (1.7 MB)
$ tripo project list --size 1 --output-format json
{"total":372,"projects":[{"project_id":"f60a5662-7655-4dbb-904a-4f45cdc1fca3","project_name":"large industrial diesel generator 3d model","operator":{"operator_id":"1073444e-d7fd-4a01-b8d8-bc6f0f2c9b9a","status":"success","type":"text_to_model","created_at":1795713099}}]}
ПРОЕКТ xd_generator: f60a5662-7655-4dbb-904a-4f45cdc1fca3
{"id": "xd_generator", "steps": [["generate", 0]], "pid": "f60a5662-7655-4dbb-904a-4f45cdc1fca3"}
```

### g98_xd_cage: python3 tools/tripo/chain.py --id xd_cage --faces 5000 --prompt Heavy steel specimen cage with thick bars, a locked door and a scratched floor plate. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 129 с, кредитов 25.0
```
$ tripo generate text Heavy steel specimen cage with thick bars, a locked door and a scratched floo... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_cage.glb
OK: Task created: f56a9cd2-e2ad-4025-88bb-f584e7f2128f
OK: Generation complete
OK: Downloaded: out/xd_cage.glb (1.6 MB)
$ tripo project list --size 1 --output-format json
{"total":373,"projects":[{"project_id":"79474c96-f03b-44d4-99cc-8adc430bbc6f","project_name":"heavy steel specimen cage 3d model","operator":{"operator_id":"f56a9cd2-e2ad-4025-88bb-f584e7f2128f","status":"success","type":"text_to_model","created_at":1795713210}}]}
ПРОЕКТ xd_cage: 79474c96-f03b-44d4-99cc-8adc430bbc6f
{"id": "xd_cage", "steps": [["generate", 0]], "pid": "79474c96-f03b-44d4-99cc-8adc430bbc6f"}
```

### g98_xd_decon: python3 tools/tripo/chain.py --id xd_decon --faces 5000 --prompt Decontamination shower arch gate: steel frame arch with spray nozzles, green lights and a drain grate floor. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, n
код 0, 105 с, кредитов 25.0
```
$ tripo generate text Decontamination shower arch gate: steel frame arch with spray nozzles, green ... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_decon.glb
OK: Task created: 4cf51f3d-5fa1-4ba3-bd67-529ecf386ed8
OK: Generation complete
OK: Downloaded: out/xd_decon.glb (2.6 MB)
$ tripo project list --size 1 --output-format json
{"total":374,"projects":[{"project_id":"fb996a95-b076-43af-86c1-b98789a6f733","project_name":"decontamination shower arch gate 3d model","operator":{"operator_id":"4cf51f3d-5fa1-4ba3-bd67-529ecf386ed8","status":"success","type":"text_to_model","created_at":1795713343}}]}
ПРОЕКТ xd_decon: fb996a95-b076-43af-86c1-b98789a6f733
{"id": "xd_decon", "steps": [["generate", 0]], "pid": "fb996a95-b076-43af-86c1-b98789a6f733"}
```

### g98_xd_scanner: python3 tools/tripo/chain.py --id xd_scanner --faces 5000 --prompt Medical body scanner machine: ring-shaped scanner with a sliding table. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 106 с, кредитов 25.0
```
$ tripo generate text Medical body scanner machine: ring-shaped scanner with a sliding table. Singl... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_scanner.glb
OK: Task created: 92af18f3-6b73-4cbd-9921-cb2249876835
OK: Generation complete
OK: Downloaded: out/xd_scanner.glb (1.8 MB)
$ tripo project list --size 1 --output-format json
{"total":375,"projects":[{"project_id":"4b0e9e16-30e1-4827-b511-539fc52c14cc","project_name":"medical body scanner machine 3d model","operator":{"operator_id":"92af18f3-6b73-4cbd-9921-cb2249876835","status":"success","type":"text_to_model","created_at":1795713453}}]}
ПРОЕКТ xd_scanner: 4b0e9e16-30e1-4827-b511-539fc52c14cc
{"id": "xd_scanner", "steps": [["generate", 0]], "pid": "4b0e9e16-30e1-4827-b511-539fc52c14cc"}
```

### g98_xd_radar: python3 tools/tripo/chain.py --id xd_radar --faces 5000 --prompt Mobile military radar station: rotating radar antenna dish on a trailer base. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 126 с, кредитов 25.0
```
$ tripo generate text Mobile military radar station: rotating radar antenna dish on a trailer base.... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_radar.glb
OK: Task created: 2fa11496-819b-4d2c-b527-997d32e27c5c
OK: Generation complete
OK: Downloaded: out/xd_radar.glb (1.7 MB)
$ tripo project list --size 1 --output-format json
{"total":376,"projects":[{"project_id":"d001f1fb-db6e-4355-b42d-24b88945b31d","project_name":"mobile military radar 3d model","operator":{"operator_id":"2fa11496-819b-4d2c-b527-997d32e27c5c","status":"success","type":"text_to_model","created_at":1795713563}}]}
ПРОЕКТ xd_radar: d001f1fb-db6e-4355-b42d-24b88945b31d
{"id": "xd_radar", "steps": [["generate", 0]], "pid": "d001f1fb-db6e-4355-b42d-24b88945b31d"}
```

### g98_xd_barrier: python3 tools/tripo/chain.py --id xd_barrier --faces 5000 --prompt Concrete jersey barriers with sandbags stacked on top and a coil of barbed wire. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 94 с, кредитов 25.0
```
$ tripo generate text Concrete jersey barriers with sandbags stacked on top and a coil of barbed wi... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_barrier.glb
OK: Task created: 4e91e3f4-2d07-452b-8929-dd15643e5ba2
OK: Generation complete
OK: Downloaded: out/xd_barrier.glb (2.1 MB)
$ tripo project list --size 1 --output-format json
{"total":377,"projects":[{"project_id":"f59d748b-14d7-4027-92a9-fd9eb3fb13f5","project_name":"concrete jersey barrier 3d model","operator":{"operator_id":"4e91e3f4-2d07-452b-8929-dd15643e5ba2","status":"success","type":"text_to_model","created_at":1795713694}}]}
ПРОЕКТ xd_barrier: f59d748b-14d7-4027-92a9-fd9eb3fb13f5
{"id": "xd_barrier", "steps": [["generate", 0]], "pid": "f59d748b-14d7-4027-92a9-fd9eb3fb13f5"}
```

### g98_xd_supply: python3 tools/tripo/chain.py --id xd_supply --faces 5000 --prompt Pile of military supply crates and barrels covered with a camouflage net. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 137 с, кредитов 25.0
```
$ tripo generate text Pile of military supply crates and barrels covered with a camouflage net. Sin... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_supply.glb
OK: Task created: 85e48c32-c638-4bc6-b177-228733dec486
OK: Generation complete
OK: Downloaded: out/xd_supply.glb (2.6 MB)
$ tripo project list --size 1 --output-format json
{"total":378,"projects":[{"project_id":"c8dc7b48-f7b6-4534-be27-39f1a091b22f","project_name":"military supply crates 3d model","operator":{"operator_id":"85e48c32-c638-4bc6-b177-228733dec486","status":"success","type":"text_to_model","created_at":1795713793}}]}
ПРОЕКТ xd_supply: c8dc7b48-f7b6-4534-be27-39f1a091b22f
{"id": "xd_supply", "steps": [["generate", 0]], "pid": "c8dc7b48-f7b6-4534-be27-39f1a091b22f"}
```

### g98_xd_searchlight: python3 tools/tripo/chain.py --id xd_searchlight --faces 5000 --prompt Military searchlight on a tripod stand with a small generator box. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 263 с, кредитов 25.0
```
$ tripo generate text Military searchlight on a tripod stand with a small generator box. Single gam... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_searchlight.glb
OK: Task created: c19fbf1f-731b-4620-b9bd-a66e65dd8568
OK: Generation complete
OK: Downloaded: out/xd_searchlight.glb (1.7 MB)
$ tripo project list --size 1 --output-format json
{"total":379,"projects":[{"project_id":"7ba4c607-9671-49bf-b51c-78d6f3d94d13","project_name":"military searchlight 3d model","operator":{"operator_id":"c19fbf1f-731b-4620-b9bd-a66e65dd8568","status":"success","type":"text_to_model","created_at":1795713935}}]}
ПРОЕКТ xd_searchlight: 7ba4c607-9671-49bf-b51c-78d6f3d94d13
{"id": "xd_searchlight", "steps": [["generate", 0]], "pid": "7ba4c607-9671-49bf-b51c-78d6f3d94d13"}
```

### g98_xd_fueltank: python3 tools/tripo/chain.py --id xd_fueltank --faces 5000 --prompt Horizontal cylindrical fuel storage tank on concrete saddles with pipes and a ladder. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 96 с, кредитов 25.0
```
$ tripo generate text Horizontal cylindrical fuel storage tank on concrete saddles with pipes and a... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_fueltank.glb
OK: Task created: 878b5eca-6b9f-4e87-a4c4-1f438f4ccc58
OK: Generation complete
OK: Downloaded: out/xd_fueltank.glb (1.9 MB)
$ tripo project list --size 1 --output-format json
{"total":380,"projects":[{"project_id":"f6c13c8b-2e80-460f-96d1-96bdd5ac44ed","project_name":"cylindrical fuel tank 3d model","operator":{"operator_id":"878b5eca-6b9f-4e87-a4c4-1f438f4ccc58","status":"success","type":"text_to_model","created_at":1795714204}}]}
ПРОЕКТ xd_fueltank: f6c13c8b-2e80-460f-96d1-96bdd5ac44ed
{"id": "xd_fueltank", "steps": [["generate", 0]], "pid": "f6c13c8b-2e80-460f-96d1-96bdd5ac44ed"}
```

### g98_xd_labmodule: python3 tools/tripo/chain.py --id xd_labmodule --faces 5000 --prompt Mobile laboratory container module, white with biohazard markings, a door and vents. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 194 с, кредитов 25.0
```
$ tripo generate text Mobile laboratory container module, white with biohazard markings, a door and... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_labmodule.glb
OK: Task created: b3fbed4e-595d-42ce-9d14-e60d1c6375ac
OK: Generation complete
OK: Downloaded: out/xd_labmodule.glb (1.5 MB)
$ tripo project list --size 1 --output-format json
{"total":381,"projects":[{"project_id":"2f1b11c6-0c2c-4f27-895c-dced3a4745e8","project_name":"mobile laboratory container module 3d model","operator":{"operator_id":"b3fbed4e-595d-42ce-9d14-e60d1c6375ac","status":"success","type":"text_to_model","created_at":1795714306}}]}
ПРОЕКТ xd_labmodule: 2f1b11c6-0c2c-4f27-895c-dced3a4745e8
{"id": "xd_labmodule", "steps": [["generate", 0]], "pid": "2f1b11c6-0c2c-4f27-895c-dced3a4745e8"}
```

### g98_xd_truck: python3 tools/tripo/chain.py --id xd_truck --faces 5000 --prompt Modern military cargo truck with a canvas cover, dark olive. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 122 с, кредитов 25.0
```
$ tripo generate text Modern military cargo truck with a canvas cover, dark olive. Single game prop... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_truck.glb
OK: Task created: 1f9cf5d0-8ef8-4014-ac9e-1527fa331dee
OK: Generation complete
OK: Downloaded: out/xd_truck.glb (1.6 MB)
$ tripo project list --size 1 --output-format json
{"total":382,"projects":[{"project_id":"4e3215f7-c7eb-4794-91fa-ab14a3ba3814","project_name":"modern military cargo truck 3d model","operator":{"operator_id":"1f9cf5d0-8ef8-4014-ac9e-1527fa331dee","status":"success","type":"text_to_model","created_at":1795714506}}]}
ПРОЕКТ xd_truck: 4e3215f7-c7eb-4794-91fa-ab14a3ba3814
{"id": "xd_truck", "steps": [["generate", 0]], "pid": "4e3215f7-c7eb-4794-91fa-ab14a3ba3814"}
```

### g98_xd_biotank: python3 tools/tripo/chain.py --id xd_biotank --faces 5000 --prompt Large vertical steel biohazard liquid tank with a green glowing window, pipes and a valve wheel. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 147 с, кредитов 25.0
```
$ tripo generate text Large vertical steel biohazard liquid tank with a green glowing window, pipes... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_biotank.glb
OK: Task created: ea5f18bd-432b-49f0-8cc1-f7197b9bbe02
OK: Generation complete
OK: Downloaded: out/xd_biotank.glb (1.9 MB)
$ tripo project list --size 1 --output-format json
{"total":383,"projects":[{"project_id":"22a1d14e-bca5-4d42-ad09-2fd716677f2e","project_name":"biohazard liquid tank 3d model","operator":{"operator_id":"ea5f18bd-432b-49f0-8cc1-f7197b9bbe02","status":"success","type":"text_to_model","created_at":1795714634}}]}
ПРОЕКТ xd_biotank: 22a1d14e-bca5-4d42-ad09-2fd716677f2e
{"id": "xd_biotank", "steps": [["generate", 0]], "pid": "22a1d14e-bca5-4d42-ad09-2fd716677f2e"}
```

### g98_xd_incubator: python3 tools/tripo/chain.py --id xd_incubator --faces 5000 --prompt Row of laboratory incubator cabinets with glass doors and glowing samples inside. Single game prop, realistic weathered PBR textures, dark military science-fiction bunker style, whole object visible, no background, no floor, no people, no text.
код 0, 174 с, кредитов 25.0
```
$ tripo generate text Row of laboratory incubator cabinets with glass doors and glowing samples ins... --face-limit 5000 --visibility private --timeout 25m --output-format json -o out/xd_incubator.glb
OK: Task created: 6d8e4030-7368-4eb4-a3c1-a54a2c64ca2d
OK: Generation complete
OK: Downloaded: out/xd_incubator.glb (1.9 MB)
$ tripo project list --size 1 --output-format json
{"total":384,"projects":[{"project_id":"459e531d-e441-47dc-b299-43d6d2f36eb5","project_name":"laboratory incubator cabinets 3d model","operator":{"operator_id":"6d8e4030-7368-4eb4-a3c1-a54a2c64ca2d","status":"success","type":"text_to_model","created_at":1795714788}}]}
ПРОЕКТ xd_incubator: 459e531d-e441-47dc-b299-43d6d2f36eb5
{"id": "xd_incubator", "steps": [["generate", 0]], "pid": "459e531d-e441-47dc-b299-43d6d2f36eb5"}
```

Стоп по jobs.json — задания не выполняются

## Баланс в конце: 3695.0 (потрачено 490.0)
