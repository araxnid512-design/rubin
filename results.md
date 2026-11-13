## Баланс на старте: 9640.0
```
Credits: 9640
Membership: premium
Subscription: premium (monthly)
```

### p11_bal0: tripo account balance
код 0, 0 с, кредитов 0.0
```
Credits: 9640
Membership: premium
Subscription: premium (monthly)
```

### p11_sobr1: python3 tools/tripo/chain.py --id h_sobr1 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt Russian SOBR special police assault operator, black balaclava, dark green ballistic helmet with goggles on top, black tactical uniform, heavy grey plate ca
код 0, 143 с, кредитов 75.0
```
$ tripo generate text Russian SOBR special police assault operator, black balaclava, dark green bal... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_sobr1.glb
OK: Task created: d20ec634-0d82-444e-a026-4b1eb5b189a8
OK: Generation complete
OK: Downloaded: out/h_sobr1.glb (5.5 MB)
$ tripo project list --size 1 --output-format json
{"total":275,"projects":[{"project_id":"33c80956-46c5-4fa1-918c-5254553e979c","project_name":"tactical operator 3d model","operator":{"operator_id":"d20ec634-0d82-444e-a026-4b1eb5b189a8","status":"success","type":"text_to_model","created_at":1794601378}}]}
ПРОЕКТ h_sobr1: 33c80956-46c5-4fa1-918c-5254553e979c
$ tripo process rig 33c80956-46c5-4fa1-918c-5254553e979c --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig 33c80956-46c5-4fa1-918c-5254553e979c --rig-type biped --format glb --timeout 20m -o out/h_sobr1_rig.glb
Project:      33c80956-46c5-4fa1-918c-5254553e979c

Submitting task...
OK: Task created: e4e253f5-2446-46f2-8276-4def2f4f3adf
Waiting for task to complete...
Status: queued (0%)
Status: running (26%)
Status: running (49%)
Status: running (71%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (5%)
Status: running (7%)
Status: running (10%)
OK: Downloaded: out/h_sobr1_rig.glb (5.5 MB)
$ tripo process animate 33c80956-46c5-4fa1-918c-5254553e979c --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_sobr1_a.glb
Project:      33c80956-46c5-4fa1-918c-5254553e979c

Submitting task...
OK: Task created: 87c0ff88-6156-4c39-963d-3e56104e3123
Waiting for task to complete...
Status: queued (0%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (2%)
Status: running (4%)
Status: running (5%)
Status: running (7%)
Status: running (8%)
Status: running (9%)
Status: running (11%)
OK: Downloaded: out/h_sobr1_a.glb (6.2 MB)
{"id": "h_sobr1", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "33c80956-46c5-4fa1-918c-5254553e979c"}
```

### p11_sobr2: python3 tools/tripo/chain.py --id h_sobr2 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt Russian special police heavy breacher, black balaclava, heavy ballistic helmet with raised armored face visor, bulky full ceramic body armor with shoulder 
код 0, 160 с, кредитов 75.0
```
$ tripo generate text Russian special police heavy breacher, black balaclava, heavy ballistic helme... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_sobr2.glb
OK: Task created: 9fc4503a-06a2-482a-89ec-9b46ec785ff0
OK: Generation complete
OK: Downloaded: out/h_sobr2.glb (6.3 MB)
$ tripo project list --size 1 --output-format json
{"total":276,"projects":[{"project_id":"3eb9e174-841c-4cee-beab-5c8566d13632","project_name":"3d модель спецназовца","operator":{"operator_id":"9fc4503a-06a2-482a-89ec-9b46ec785ff0","status":"success","type":"text_to_model","created_at":1794601524}}]}
ПРОЕКТ h_sobr2: 3eb9e174-841c-4cee-beab-5c8566d13632
$ tripo process rig 3eb9e174-841c-4cee-beab-5c8566d13632 --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig 3eb9e174-841c-4cee-beab-5c8566d13632 --rig-type biped --format glb --timeout 20m -o out/h_sobr2_rig.glb
Project:      3eb9e174-841c-4cee-beab-5c8566d13632

Submitting task...
OK: Task created: 01c90ae5-fc71-47d0-8596-085a6f4204ee
Waiting for task to complete...
Status: queued (0%)
Status: running (26%)
Status: running (51%)
Status: running (76%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (4%)
Status: running (6%)
OK: Downloaded: out/h_sobr2_rig.glb (6.3 MB)
$ tripo process animate 3eb9e174-841c-4cee-beab-5c8566d13632 --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_sobr2_a.glb
Project:      3eb9e174-841c-4cee-beab-5c8566d13632

Submitting task...
OK: Task created: c11199d6-be4d-4c21-bcc6-c85a202f130b
Waiting for task to complete...
Status: queued (0%)
Status: running (76%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (49%)
Status: running (83%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
OK: Downloaded: out/h_sobr2_a.glb (7.0 MB)
{"id": "h_sobr2", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "3eb9e174-841c-4cee-beab-5c8566d13632"}
```

### p11_sobr3: python3 tools/tripo/chain.py --id h_sobr3 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt Russian special police sniper, olive camouflage gorka suit worn over a light armor vest, boonie hat, black balaclava, shooting gloves, ammo pouches on ches
код 0, 146 с, кредитов 75.0
```
$ tripo generate text Russian special police sniper, olive camouflage gorka suit worn over a light ... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_sobr3.glb
OK: Task created: 632222d1-23e3-434a-89e5-11655d72354f
OK: Generation complete
OK: Downloaded: out/h_sobr3.glb (6.1 MB)
$ tripo project list --size 1 --output-format json
{"total":277,"projects":[{"project_id":"dd77d2cf-a02d-4bd2-a8c7-e9e9de3bcfcc","project_name":"military soldier 3d model","operator":{"operator_id":"632222d1-23e3-434a-89e5-11655d72354f","status":"success","type":"text_to_model","created_at":1794601690}}]}
ПРОЕКТ h_sobr3: dd77d2cf-a02d-4bd2-a8c7-e9e9de3bcfcc
$ tripo process rig dd77d2cf-a02d-4bd2-a8c7-e9e9de3bcfcc --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig dd77d2cf-a02d-4bd2-a8c7-e9e9de3bcfcc --rig-type biped --format glb --timeout 20m -o out/h_sobr3_rig.glb
Project:      dd77d2cf-a02d-4bd2-a8c7-e9e9de3bcfcc

Submitting task...
OK: Task created: 8529269c-7602-4113-974c-be7dc22262b3
Waiting for task to complete...
Status: queued (0%)
Status: running (16%)
Status: running (29%)
Status: running (43%)
Status: running (56%)
Status: running (69%)
Status: running (83%)
Status: running (96%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (7%)
Status: running (13%)
OK: Downloaded: out/h_sobr3_rig.glb (6.1 MB)
$ tripo process animate dd77d2cf-a02d-4bd2-a8c7-e9e9de3bcfcc --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_sobr3_a.glb
Project:      dd77d2cf-a02d-4bd2-a8c7-e9e9de3bcfcc

Submitting task...
OK: Task created: c43e426c-2f45-46b1-a6c8-9693cbf321d7
Waiting for task to complete...
Status: queued (0%)
Status: running (99%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (12%)
Status: running (19%)
Status: running (27%)
Status: running (34%)
Status: running (42%)
Status: running (49%)
Status: running (56%)
Status: running (64%)
OK: Downloaded: out/h_sobr3_a.glb (6.8 MB)
{"id": "h_sobr3", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "dd77d2cf-a02d-4bd2-a8c7-e9e9de3bcfcc"}
```

### p11_sobr4: python3 tools/tripo/chain.py --id h_sobr4 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt Russian special police squad commander, black balaclava pulled down to the neck, stern middle-aged face with short grey stubble, dark helmet with headset a
код 0, 226 с, кредитов 75.0
```
$ tripo generate text Russian special police squad commander, black balaclava pulled down to the ne... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_sobr4.glb
OK: Task created: 039dd1fc-633a-4f92-bb45-c645851ca3cf
OK: Generation complete
OK: Downloaded: out/h_sobr4.glb (5.9 MB)
$ tripo project list --size 1 --output-format json
{"total":278,"projects":[{"project_id":"48cdd154-bd4c-4ad7-bf09-206084e9df58","project_name":"3d-модель тактический оператор","operator":{"operator_id":"039dd1fc-633a-4f92-bb45-c645851ca3cf","status":"success","type":"text_to_model","created_at":1794601843}}]}
ПРОЕКТ h_sobr4: 48cdd154-bd4c-4ad7-bf09-206084e9df58
$ tripo process rig 48cdd154-bd4c-4ad7-bf09-206084e9df58 --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig 48cdd154-bd4c-4ad7-bf09-206084e9df58 --rig-type biped --format glb --timeout 20m -o out/h_sobr4_rig.glb
Project:      48cdd154-bd4c-4ad7-bf09-206084e9df58

Submitting task...
OK: Task created: ec6ff07b-159a-451b-a82a-aaba363fb0ce
Waiting for task to complete...
Status: queued (0%)
Status: queued (0%)
Status: running (21%)
Status: running (32%)
Status: running (42%)
Status: running (52%)
Status: running (63%)
Status: running (73%)
Status: running (83%)
Status: running (94%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (3%)
Status: running (5%)
OK: Downloaded: out/h_sobr4_rig.glb (5.9 MB)
$ tripo process animate 48cdd154-bd4c-4ad7-bf09-206084e9df58 --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_sobr4_a.glb
Project:      48cdd154-bd4c-4ad7-bf09-206084e9df58

Submitting task...
OK: Task created: f1484b3a-c9a1-49d4-8b4c-862970d05dde
Waiting for task to complete...
Status: queued (0%)
Status: running (99%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (44%)
Status: running (82%)
Status: running (99%)
Status: running (99%)
OK: Downloaded: out/h_sobr4_a.glb (6.6 MB)
{"id": "h_sobr4", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "48cdd154-bd4c-4ad7-bf09-206084e9df58"}
```

### p11_sobr5: python3 tools/tripo/chain.py --id h_sobr5 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt Russian special police machine gunner, big broad-shouldered man, black balaclava, ballistic helmet, black tactical uniform, heavy plate carrier with large 
код 0, 148 с, кредитов 75.0
```
$ tripo generate text Russian special police machine gunner, big broad-shouldered man, black balacl... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_sobr5.glb
OK: Task created: 1d9c64ae-bc6e-48af-8244-41163472f339
OK: Generation complete
OK: Downloaded: out/h_sobr5.glb (5.4 MB)
$ tripo project list --size 1 --output-format json
{"total":279,"projects":[{"project_id":"ef581432-436e-441a-9b2b-b7703d12df91","project_name":"тактический солдат 3d модель","operator":{"operator_id":"1d9c64ae-bc6e-48af-8244-41163472f339","status":"success","type":"text_to_model","created_at":1794602078}}]}
ПРОЕКТ h_sobr5: ef581432-436e-441a-9b2b-b7703d12df91
$ tripo process rig ef581432-436e-441a-9b2b-b7703d12df91 --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig ef581432-436e-441a-9b2b-b7703d12df91 --rig-type biped --format glb --timeout 20m -o out/h_sobr5_rig.glb
Project:      ef581432-436e-441a-9b2b-b7703d12df91

Submitting task...
OK: Task created: 8f0900ae-fabf-4fc3-be09-4dc6ff9714d0
Waiting for task to complete...
Status: queued (0%)
Status: running (47%)
Status: running (87%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (4%)
Status: running (6%)
Status: running (9%)
OK: Downloaded: out/h_sobr5_rig.glb (5.4 MB)
$ tripo process animate ef581432-436e-441a-9b2b-b7703d12df91 --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_sobr5_a.glb
Project:      ef581432-436e-441a-9b2b-b7703d12df91

Submitting task...
OK: Task created: 67ae1060-5995-4e22-b11f-c5831e946475
Waiting for task to complete...
Status: queued (0%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (60%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
OK: Downloaded: out/h_sobr5_a.glb (6.2 MB)
{"id": "h_sobr5", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "ef581432-436e-441a-9b2b-b7703d12df91"}
```

### p11_clan1: python3 tools/tripo/chain.py --id h_clan1 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt lean tough male convict gang fighter, shaved head, black leather jacket over a dirty tracksuit, scarred knuckles, worn sneakers, full body, T-pose, arms st
код 0, 150 с, кредитов 75.0
```
$ tripo generate text lean tough male convict gang fighter, shaved head, black leather jacket over ... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_clan1.glb
OK: Task created: ac3db2b7-44f2-4ef3-a97c-b19224fcc7f0
OK: Generation complete
OK: Downloaded: out/h_clan1.glb (6.0 MB)
$ tripo project list --size 1 --output-format json
{"total":280,"projects":[{"project_id":"4d5a94ab-175f-479a-90e1-ac0f2b0cf21c","project_name":"convict character 3d model","operator":{"operator_id":"ac3db2b7-44f2-4ef3-a97c-b19224fcc7f0","status":"success","type":"text_to_model","created_at":1794602238}}]}
ПРОЕКТ h_clan1: 4d5a94ab-175f-479a-90e1-ac0f2b0cf21c
$ tripo process rig 4d5a94ab-175f-479a-90e1-ac0f2b0cf21c --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig 4d5a94ab-175f-479a-90e1-ac0f2b0cf21c --rig-type biped --format glb --timeout 20m -o out/h_clan1_rig.glb
Project:      4d5a94ab-175f-479a-90e1-ac0f2b0cf21c

Submitting task...
OK: Task created: 1f1e1241-6a01-4432-b3f0-fdd2352ef72d
Waiting for task to complete...
Status: queued (0%)
Status: running (24%)
Status: running (43%)
Status: running (62%)
Status: running (81%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (57%)
Status: running (99%)
OK: Downloaded: out/h_clan1_rig.glb (6.0 MB)
$ tripo process animate 4d5a94ab-175f-479a-90e1-ac0f2b0cf21c --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_clan1_a.glb
Project:      4d5a94ab-175f-479a-90e1-ac0f2b0cf21c

Submitting task...
OK: Task created: e2ac97bd-2d85-4dfa-ae6b-92a2e971afd9
Waiting for task to complete...
Status: queued (0%)
Status: running (99%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (56%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
OK: Downloaded: out/h_clan1_a.glb (6.8 MB)
{"id": "h_clan1", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "4d5a94ab-175f-479a-90e1-ac0f2b0cf21c"}
```

### p11_clan2: python3 tools/tripo/chain.py --id h_clan2 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt stocky male gang fighter, dark wool flat cap, padded black quilted jacket, cargo trousers, fingerless gloves, worn army boots, full body, T-pose, arms stra
код 0, 148 с, кредитов 75.0
```
$ tripo generate text stocky male gang fighter, dark wool flat cap, padded black quilted jacket, ca... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_clan2.glb
OK: Task created: 6eb9c34a-83dc-4d9a-903f-eb57c90114d4
OK: Generation complete
OK: Downloaded: out/h_clan2.glb (5.7 MB)
$ tripo project list --size 1 --output-format json
{"total":281,"projects":[{"project_id":"2790ca80-711d-46f1-9b16-c9a923717e74","project_name":"stocky fighter 3d model","operator":{"operator_id":"6eb9c34a-83dc-4d9a-903f-eb57c90114d4","status":"success","type":"text_to_model","created_at":1794602404}}]}
ПРОЕКТ h_clan2: 2790ca80-711d-46f1-9b16-c9a923717e74
$ tripo process rig 2790ca80-711d-46f1-9b16-c9a923717e74 --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig 2790ca80-711d-46f1-9b16-c9a923717e74 --rig-type biped --format glb --timeout 20m -o out/h_clan2_rig.glb
Project:      2790ca80-711d-46f1-9b16-c9a923717e74

Submitting task...
OK: Task created: 952fdfeb-65d6-4b07-939e-48f3ef54a480
Waiting for task to complete...
Status: queued (0%)
Status: running (15%)
Status: running (30%)
Status: running (44%)
Status: running (58%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (4%)
Status: running (7%)
Status: running (10%)
OK: Downloaded: out/h_clan2_rig.glb (5.7 MB)
$ tripo process animate 2790ca80-711d-46f1-9b16-c9a923717e74 --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_clan2_a.glb
Project:      2790ca80-711d-46f1-9b16-c9a923717e74

Submitting task...
OK: Task created: e78f71c3-4613-4221-9a04-5685b703a1c3
Waiting for task to complete...
Status: queued (0%)
Status: running (99%)
OK: Task complete
Exporting as glb...
Status: running (1%)
Status: running (4%)
Status: running (6%)
Status: running (9%)
OK: Downloaded: out/h_clan2_a.glb (6.4 MB)
{"id": "h_clan2", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "2790ca80-711d-46f1-9b16-c9a923717e74"}
```

### p11_clan3: python3 tools/tripo/chain.py --id h_clan3 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt young male gang fighter, grey hoodie with hood down, black bandana over the lower face, tracksuit trousers, worn sneakers, cloth wraps on hands, full body,
код 0, 177 с, кредитов 75.0
```
$ tripo generate text young male gang fighter, grey hoodie with hood down, black bandana over the l... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_clan3.glb
OK: Task created: adc1ad50-7645-4b80-ac67-8e0b970436d7
OK: Generation complete
OK: Downloaded: out/h_clan3.glb (6.4 MB)
$ tripo project list --size 1 --output-format json
{"total":282,"projects":[{"project_id":"f936a7d7-d77c-4b25-b12a-0c5110ec17be","project_name":"hooded fighter 3d model","operator":{"operator_id":"adc1ad50-7645-4b80-ac67-8e0b970436d7","status":"success","type":"text_to_model","created_at":1794602570}}]}
ПРОЕКТ h_clan3: f936a7d7-d77c-4b25-b12a-0c5110ec17be
$ tripo process rig f936a7d7-d77c-4b25-b12a-0c5110ec17be --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig f936a7d7-d77c-4b25-b12a-0c5110ec17be --rig-type biped --format glb --timeout 20m -o out/h_clan3_rig.glb
Project:      f936a7d7-d77c-4b25-b12a-0c5110ec17be

Submitting task...
OK: Task created: 14c443c6-c753-4804-ba85-2ddb598d824a
Waiting for task to complete...
Status: queued (0%)
Status: running (9%)
Status: running (16%)
Status: running (24%)
Status: running (31%)
Status: running (39%)
Status: running (46%)
Status: running (53%)
Status: running (61%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (6%)
Status: running (10%)
Status: running (14%)
Status: running (18%)
Status: running (23%)
Status: running (27%)
Status: running (31%)
Status: running (35%)
OK: Downloaded: out/h_clan3_rig.glb (6.4 MB)
$ tripo process animate f936a7d7-d77c-4b25-b12a-0c5110ec17be --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_clan3_a.glb
Project:      f936a7d7-d77c-4b25-b12a-0c5110ec17be

Submitting task...
OK: Task created: 80057012-f978-4106-95c1-4a7551ab1133
Waiting for task to complete...
Status: queued (0%)
Status: running (99%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (5%)
Status: running (8%)
Status: running (12%)
Status: running (15%)
OK: Downloaded: out/h_clan3_a.glb (7.2 MB)
{"id": "h_clan3", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "f936a7d7-d77c-4b25-b12a-0c5110ec17be"}
```

### p11_clan4: python3 tools/tripo/chain.py --id h_clan4 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt tall male gang fighter, long black coat over a sweater, short beard, knitted beanie, heavy leather boots, full body, T-pose, arms straight out to the sides
код 0, 144 с, кредитов 75.0
```
$ tripo generate text tall male gang fighter, long black coat over a sweater, short beard, knitted ... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_clan4.glb
OK: Task created: e0cdd36c-47dd-4b88-a0a9-b512d087869d
OK: Generation complete
OK: Downloaded: out/h_clan4.glb (5.9 MB)
$ tripo project list --size 1 --output-format json
{"total":283,"projects":[{"project_id":"e8afd9da-0092-4ba5-97ba-7f8ef20b957e","project_name":"gang fighter 3d model","operator":{"operator_id":"e0cdd36c-47dd-4b88-a0a9-b512d087869d","status":"success","type":"text_to_model","created_at":1794602772}}]}
ПРОЕКТ h_clan4: e8afd9da-0092-4ba5-97ba-7f8ef20b957e
$ tripo process rig e8afd9da-0092-4ba5-97ba-7f8ef20b957e --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig e8afd9da-0092-4ba5-97ba-7f8ef20b957e --rig-type biped --format glb --timeout 20m -o out/h_clan4_rig.glb
Project:      e8afd9da-0092-4ba5-97ba-7f8ef20b957e

Submitting task...
OK: Task created: 5be0a568-130a-4c01-a44e-9c1e8ee61ca9
Waiting for task to complete...
Status: queued (0%)
Status: running (15%)
Status: running (28%)
Status: running (42%)
Status: running (55%)
Status: running (69%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (40%)
Status: running (70%)
Status: running (99%)
OK: Downloaded: out/h_clan4_rig.glb (5.8 MB)
$ tripo process animate e8afd9da-0092-4ba5-97ba-7f8ef20b957e --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_clan4_a.glb
Project:      e8afd9da-0092-4ba5-97ba-7f8ef20b957e

Submitting task...
OK: Task created: 0f07ef6e-269d-43df-b24d-353b02269c6e
Waiting for task to complete...
Status: queued (0%)
Status: running (46%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (7%)
Status: running (12%)
Status: running (17%)
Status: running (23%)
Status: running (28%)
Status: running (33%)
Status: running (38%)
Status: running (43%)
Status: running (49%)
OK: Downloaded: out/h_clan4_a.glb (6.6 MB)
{"id": "h_clan4", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "e8afd9da-0092-4ba5-97ba-7f8ef20b957e"}
```

### p11_clan5: python3 tools/tripo/chain.py --id h_clan5 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt older male gang leader, grizzled grey beard, heavy sheepskin coat over a black shirt, gold chain, leather boots, confident stance, full body, T-pose, arms 
код 0, 158 с, кредитов 75.0
```
$ tripo generate text older male gang leader, grizzled grey beard, heavy sheepskin coat over a blac... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_clan5.glb
OK: Task created: c4f0e12d-eb0d-4a70-89b7-d6eebe3dc857
OK: Generation complete
OK: Downloaded: out/h_clan5.glb (6.5 MB)
$ tripo project list --size 1 --output-format json
{"total":284,"projects":[{"project_id":"a956a517-03bc-4e7a-ab5a-6a84ea7e81bb","project_name":"gang leader 3d model","operator":{"operator_id":"c4f0e12d-eb0d-4a70-89b7-d6eebe3dc857","status":"success","type":"text_to_model","created_at":1794602943}}]}
ПРОЕКТ h_clan5: a956a517-03bc-4e7a-ab5a-6a84ea7e81bb
$ tripo process rig a956a517-03bc-4e7a-ab5a-6a84ea7e81bb --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig a956a517-03bc-4e7a-ab5a-6a84ea7e81bb --rig-type biped --format glb --timeout 20m -o out/h_clan5_rig.glb
Project:      a956a517-03bc-4e7a-ab5a-6a84ea7e81bb

Submitting task...
OK: Task created: f3c96164-e5c4-4220-ad2d-5c14f1cab762
Waiting for task to complete...
Status: queued (0%)
Status: running (7%)
Status: running (12%)
Status: running (18%)
Status: running (24%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (4%)
Status: running (6%)
Status: running (9%)
Status: running (11%)
Status: running (14%)
OK: Downloaded: out/h_clan5_rig.glb (6.5 MB)
$ tripo process animate a956a517-03bc-4e7a-ab5a-6a84ea7e81bb --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_clan5_a.glb
Project:      a956a517-03bc-4e7a-ab5a-6a84ea7e81bb

Submitting task...
OK: Task created: 272591cd-80ad-447c-aeda-f30da0e6727e
Waiting for task to complete...
Status: queued (0%)
Status: running (99%)
Status: running (99%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (45%)
Status: running (82%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
Status: running (99%)
OK: Downloaded: out/h_clan5_a.glb (7.2 MB)
{"id": "h_clan5", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "a956a517-03bc-4e7a-ab5a-6a84ea7e81bb"}
```

### p11_clan6: python3 tools/tripo/chain.py --id h_clan6 --faces 20000 --tex detailed --geo detailed --pbr --rig biped --anims preset:biped:idle,preset:biped:walk,preset:biped:run --prompt muscular male gang brute, sleeveless padded vest over bare tattooed arms, shaved head, camouflage trousers, army boots, full body, T-pose, arms straight ou
код 0, 168 с, кредитов 75.0
```
$ tripo generate text muscular male gang brute, sleeveless padded vest over bare tattooed arms, sha... --face-limit 20000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/h_clan6.glb
OK: Task created: db3b4f6c-958f-4519-8dfa-76f61449654b
OK: Generation complete
OK: Downloaded: out/h_clan6.glb (5.9 MB)
$ tripo project list --size 1 --output-format json
{"total":285,"projects":[{"project_id":"127c501b-6b5e-4b3a-82b4-2f1b44700d3b","project_name":"military soldier 3d model","operator":{"operator_id":"db3b4f6c-958f-4519-8dfa-76f61449654b","status":"success","type":"text_to_model","created_at":1794603123}}]}
ПРОЕКТ h_clan6: 127c501b-6b5e-4b3a-82b4-2f1b44700d3b
$ tripo process rig 127c501b-6b5e-4b3a-82b4-2f1b44700d3b --check --timeout 10m
Riggable: true
RigType:  biped
$ tripo process rig 127c501b-6b5e-4b3a-82b4-2f1b44700d3b --rig-type biped --format glb --timeout 20m -o out/h_clan6_rig.glb
Project:      127c501b-6b5e-4b3a-82b4-2f1b44700d3b

Submitting task...
OK: Task created: 134a7eb4-de89-44df-b462-da05c50d2548
Waiting for task to complete...
Status: queued (0%)
Status: running (40%)
Status: running (70%)
Status: running (99%)
Status: running (99%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (3%)
Status: running (5%)
Status: running (7%)
OK: Downloaded: out/h_clan6_rig.glb (5.9 MB)
$ tripo process animate 127c501b-6b5e-4b3a-82b4-2f1b44700d3b --animations preset:biped:idle,preset:biped:walk,preset:biped:run --rig-type biped --timeout 25m -o out/h_clan6_a.glb
Project:      127c501b-6b5e-4b3a-82b4-2f1b44700d3b

Submitting task...
OK: Task created: 6d33a6e7-0440-4edf-b66e-3d276c255c82
Waiting for task to complete...
Status: running (47%)
OK: Task complete
Exporting as glb...
Status: queued (0%)
Status: running (14%)
Status: running (24%)
Status: running (34%)
Status: running (45%)
Status: running (55%)
Status: running (65%)
Status: running (75%)
Status: running (85%)
OK: Downloaded: out/h_clan6_a.glb (6.6 MB)
{"id": "h_clan6", "steps": [["generate", 0], ["rigcheck", 0], ["rig", 0], ["animate_a", 0, "preset:biped:idle,preset:biped:walk,preset:biped:run"]], "pid": "127c501b-6b5e-4b3a-82b4-2f1b44700d3b"}
```

### p11_ak74m: python3 tools/tripo/chain.py --id w_ak74m --faces 14000 --tex detailed --geo detailed --pbr --prompt Russian AK-74M assault rifle, black polymer furniture, side rail with red dot collimator sight, vertical foregrip, folding stock, 5.45 curved magazine, realistic, highly detailed PBR textures, worn, game-ready weapon model, sing
код 0, 77 с, кредитов 55.0
```
$ tripo generate text Russian AK-74M assault rifle, black polymer furniture, side rail with red dot... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_ak74m.glb
OK: Task created: 0c6a1462-81ee-46ad-8049-54fc33f28498
OK: Generation complete
OK: Downloaded: out/w_ak74m.glb (5.6 MB)
$ tripo project list --size 1 --output-format json
{"total":286,"projects":[{"project_id":"e36c64c8-55fe-4581-a404-a5ede8956b81","project_name":"ak-74m 3d model","operator":{"operator_id":"0c6a1462-81ee-46ad-8049-54fc33f28498","status":"success","type":"text_to_model","created_at":1794603314}}]}
ПРОЕКТ w_ak74m: e36c64c8-55fe-4581-a404-a5ede8956b81
{"id": "w_ak74m", "steps": [["generate", 0]], "pid": "e36c64c8-55fe-4581-a404-a5ede8956b81"}
```

### p11_val: python3 tools/tripo/chain.py --id w_val --faces 14000 --tex detailed --geo detailed --pbr --prompt Russian AS Val silenced assault rifle, integrated thick suppressor barrel, skeleton folding metal stock, short curved 9x39 magazine, black finish, realistic, highly detailed PBR textures, worn, game-ready weapon model, single obje
код 0, 87 с, кредитов 55.0
```
$ tripo generate text Russian AS Val silenced assault rifle, integrated thick suppressor barrel, sk... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_val.glb
OK: Task created: 17381874-a474-4c14-b40e-0e1dd61320cb
OK: Generation complete
OK: Downloaded: out/w_val.glb (6.1 MB)
$ tripo project list --size 1 --output-format json
{"total":287,"projects":[{"project_id":"e19e278f-7771-45dd-bdd2-bf5e1d37dd1a","project_name":"штурмовая винтовка 3d модель","operator":{"operator_id":"17381874-a474-4c14-b40e-0e1dd61320cb","status":"success","type":"text_to_model","created_at":1794603414}}]}
ПРОЕКТ w_val: e19e278f-7771-45dd-bdd2-bf5e1d37dd1a
{"id": "w_val", "steps": [["generate", 0]], "pid": "e19e278f-7771-45dd-bdd2-bf5e1d37dd1a"}
```

### p11_vss: python3 tools/tripo/chain.py --id w_vss --faces 14000 --tex detailed --geo detailed --pbr --prompt Russian VSS Vintorez silenced sniper rifle, integrated suppressor, skeleton wooden stock with cheek rest, PSO-1 optical sight, short box magazine, realistic, highly detailed PBR textures, worn, game-ready weapon model, single obje
код 0, 72 с, кредитов 55.0
```
$ tripo generate text Russian VSS Vintorez silenced sniper rifle, integrated suppressor, skeleton w... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_vss.glb
OK: Task created: 919f8d4d-e699-4572-9e97-94a48e4c7482
OK: Generation complete
OK: Downloaded: out/w_vss.glb (6.6 MB)
$ tripo project list --size 1 --output-format json
{"total":288,"projects":[{"project_id":"21c8deb0-b20b-440a-9a88-e45dc66b1d7b","project_name":"silenced sniper rifle 3d model","operator":{"operator_id":"919f8d4d-e699-4572-9e97-94a48e4c7482","status":"success","type":"text_to_model","created_at":1794603545}}]}
ПРОЕКТ w_vss: 21c8deb0-b20b-440a-9a88-e45dc66b1d7b
{"id": "w_vss", "steps": [["generate", 0]], "pid": "21c8deb0-b20b-440a-9a88-e45dc66b1d7b"}
```

### p11_pkp: python3 tools/tripo/chain.py --id w_pkp --faces 14000 --tex detailed --geo detailed --pbr --prompt Russian PKP Pecheneg general purpose machine gun, heavy finned barrel with carry handle, folded bipod, box ammo belt container under receiver, skeleton stock, realistic, highly detailed PBR textures, worn, game-ready weapon model,
код 0, 89 с, кредитов 55.0
```
$ tripo generate text Russian PKP Pecheneg general purpose machine gun, heavy finned barrel with ca... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_pkp.glb
OK: Task created: 2ab05a87-c15f-495a-a196-1bf25dbd48d3
OK: Generation complete
OK: Downloaded: out/w_pkp.glb (6.3 MB)
$ tripo project list --size 1 --output-format json
{"total":289,"projects":[{"project_id":"557de057-f481-4798-9f44-dde80f8a5763","project_name":"модель 3d пкп печенег","operator":{"operator_id":"2ab05a87-c15f-495a-a196-1bf25dbd48d3","status":"success","type":"text_to_model","created_at":1794603643}}]}
ПРОЕКТ w_pkp: 557de057-f481-4798-9f44-dde80f8a5763
{"id": "w_pkp", "steps": [["generate", 0]], "pid": "557de057-f481-4798-9f44-dde80f8a5763"}
```

### p11_vityaz: python3 tools/tripo/chain.py --id w_vityaz --faces 14000 --tex detailed --geo detailed --pbr --prompt Russian PP-19-01 Vityaz submachine gun, AK-style receiver, side folding stock, red dot sight, straight 9mm magazine, black, realistic, highly detailed PBR textures, worn, game-ready weapon model, single object, side view, cente
код 0, 78 с, кредитов 55.0
```
$ tripo generate text Russian PP-19-01 Vityaz submachine gun, AK-style receiver, side folding stock... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_vityaz.glb
OK: Task created: 22cd45ad-49b3-4c2b-91cf-094492bf3a75
OK: Generation complete
OK: Downloaded: out/w_vityaz.glb (6.0 MB)
$ tripo project list --size 1 --output-format json
{"total":290,"projects":[{"project_id":"da36aed6-d908-4edf-b88c-6bc1f47ac07e","project_name":"3d-модель пп-19-01 витязь","operator":{"operator_id":"22cd45ad-49b3-4c2b-91cf-094492bf3a75","status":"success","type":"text_to_model","created_at":1794603763}}]}
ПРОЕКТ w_vityaz: da36aed6-d908-4edf-b88c-6bc1f47ac07e
{"id": "w_vityaz", "steps": [["generate", 0]], "pid": "da36aed6-d908-4edf-b88c-6bc1f47ac07e"}
```

### p11_shield: python3 tools/tripo/chain.py --id w_shield --faces 14000 --tex detailed --geo detailed --pbr --prompt heavy ballistic police assault shield, rectangular curved dark grey shield with a narrow armored glass viewport at the top and a handle on the back, standing upright, realistic, highly detailed PBR textures, worn, game-ready we
код 0, 115 с, кредитов 55.0
```
$ tripo generate text heavy ballistic police assault shield, rectangular curved dark grey shield wi... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_shield.glb
OK: Task created: d8b326c8-657d-4366-b996-5bd2d3f50597
OK: Generation complete
OK: Downloaded: out/w_shield.glb (5.1 MB)
$ tripo project list --size 1 --output-format json
{"total":291,"projects":[{"project_id":"bf56cc4b-7a83-445a-b990-59d1e8bc3a9e","project_name":"heavy ballistic shield 3d model","operator":{"operator_id":"d8b326c8-657d-4366-b996-5bd2d3f50597","status":"success","type":"text_to_model","created_at":1794603876}}]}
ПРОЕКТ w_shield: bf56cc4b-7a83-445a-b990-59d1e8bc3a9e
{"id": "w_shield", "steps": [["generate", 0]], "pid": "bf56cc4b-7a83-445a-b990-59d1e8bc3a9e"}
```

### p11_gsh18: python3 tools/tripo/chain.py --id w_gsh18 --faces 14000 --tex detailed --geo detailed --pbr --prompt Russian GSh-18 semi-automatic pistol, black polymer frame, side view, realistic, highly detailed PBR textures, worn, game-ready weapon model, single object, side view, centered, full object visible, neutral background
код 0, 82 с, кредитов 55.0
```
$ tripo generate text Russian GSh-18 semi-automatic pistol, black polymer frame, side view, realist... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_gsh18.glb
OK: Task created: b7910a72-d335-49a5-afc5-4f5067e8898d
OK: Generation complete
OK: Downloaded: out/w_gsh18.glb (6.4 MB)
$ tripo project list --size 1 --output-format json
{"total":292,"projects":[{"project_id":"5042fa73-a93d-4daf-a47f-23f1a49d2721","project_name":"gsh-18 pistol 3d model","operator":{"operator_id":"b7910a72-d335-49a5-afc5-4f5067e8898d","status":"success","type":"text_to_model","created_at":1794604032}}]}
ПРОЕКТ w_gsh18: 5042fa73-a93d-4daf-a47f-23f1a49d2721
{"id": "w_gsh18", "steps": [["generate", 0]], "pid": "5042fa73-a93d-4daf-a47f-23f1a49d2721"}
```

### p11_obrez: python3 tools/tripo/chain.py --id w_obrez --faces 14000 --tex detailed --geo detailed --pbr --prompt sawn-off double-barrel shotgun, cut down barrels, cut wooden stock pistol grip, worn blued steel, realistic, highly detailed PBR textures, worn, game-ready weapon model, single object, side view, centered, full object visible, n
код 0, 64 с, кредитов 55.0
```
$ tripo generate text sawn-off double-barrel shotgun, cut down barrels, cut wooden stock pistol gri... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_obrez.glb
OK: Task created: 1d505a43-8da7-433c-ad74-b1ee9766c71e
OK: Generation complete
OK: Downloaded: out/w_obrez.glb (6.2 MB)
$ tripo project list --size 1 --output-format json
{"total":293,"projects":[{"project_id":"dc0535a1-3745-4f32-87f1-b0286942d023","project_name":"double-barrel shotgun 3d model","operator":{"operator_id":"1d505a43-8da7-433c-ad74-b1ee9766c71e","status":"success","type":"text_to_model","created_at":1794604145}}]}
ПРОЕКТ w_obrez: dc0535a1-3745-4f32-87f1-b0286942d023
{"id": "w_obrez", "steps": [["generate", 0]], "pid": "dc0535a1-3745-4f32-87f1-b0286942d023"}
```

### p11_machete: python3 tools/tripo/chain.py --id w_machete --faces 14000 --tex detailed --geo detailed --pbr --prompt large heavy machete, worn steel blade with scratches, wooden handle wrapped in black tape, realistic, highly detailed PBR textures, worn, game-ready weapon model, single object, side view, centered, full object visible, neutra
код 0, 81 с, кредитов 55.0
```
$ tripo generate text large heavy machete, worn steel blade with scratches, wooden handle wrapped i... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_machete.glb
OK: Task created: 9555841d-ce7a-4bf3-b69a-2d54f02ecdff
OK: Generation complete
OK: Downloaded: out/w_machete.glb (6.4 MB)
$ tripo project list --size 1 --output-format json
{"total":294,"projects":[{"project_id":"271ff6f8-9362-4805-9bf3-056af7e54a98","project_name":"heavy machete 3d model","operator":{"operator_id":"9555841d-ce7a-4bf3-b69a-2d54f02ecdff","status":"success","type":"text_to_model","created_at":1794604240}}]}
ПРОЕКТ w_machete: 271ff6f8-9362-4805-9bf3-056af7e54a98
{"id": "w_machete", "steps": [["generate", 0]], "pid": "271ff6f8-9362-4805-9bf3-056af7e54a98"}
```

### p11_tt: python3 tools/tripo/chain.py --id w_tt --faces 14000 --tex detailed --geo detailed --pbr --prompt Soviet TT-33 Tokarev pistol, worn blued steel, side view, realistic, highly detailed PBR textures, worn, game-ready weapon model, single object, side view, centered, full object visible, neutral background
код 0, 88 с, кредитов 55.0
```
$ tripo generate text Soviet TT-33 Tokarev pistol, worn blued steel, side view, realistic, highly d... --face-limit 14000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/w_tt.glb
OK: Task created: 36a0b839-dc49-479d-b666-6415cf21b0de
OK: Generation complete
OK: Downloaded: out/w_tt.glb (6.1 MB)
$ tripo project list --size 1 --output-format json
{"total":295,"projects":[{"project_id":"1d9e74cf-31b4-4ea1-876f-816ec1c35fca","project_name":"tokarev pistol 3d model","operator":{"operator_id":"36a0b839-dc49-479d-b666-6415cf21b0de","status":"success","type":"text_to_model","created_at":1794604375}}]}
ПРОЕКТ w_tt: 1d9e74cf-31b4-4ea1-876f-816ec1c35fca
{"id": "w_tt", "steps": [["generate", 0]], "pid": "1d9e74cf-31b4-4ea1-876f-816ec1c35fca"}
```

### p11_mot_shieldwalk: python3 tools/tripo/motion.py krut:66e10fd9-0838-44e4-bea8-c889f60b9456 shieldwalk 3 soldier walks forward slowly holding a heavy ballistic shield in front of the body with the left arm, pistol in the right hand aimed forward over the shield edge
код 0, 18 с, кредитов 20.0
```
движение «shieldwalk»: «soldier walks forward slowly holding a heavy ballistic shield in front of the body with the left arm, pistol in the right hand aimed forward over the shield edge», 3 с
motion/generate: {"task_id": "ffe4cab0-f5fb-4af6-8664-15819376d971", "status": "queued", "submitted_at": "2026-11-13T21:14:51.776651Z", "expires_at": "2026-11-13T21:19:51.776651Z", "asset_id": null, "error": null}
  движение: success 
asset_id: 44cb9c4c-4778-4988-81ab-46c30ecde5bd
retarget: 398ce4c8-8124-4427-b8f6-9e8bc96a4238
  398ce4c8: queued 0
  398ce4c8: success 100
  1d7a7d56: queued 0
  1d7a7d56: success 100
готово: out/m_krut_shieldwalk.glb (2.0 МБ)
```

### p11_mot_shieldshoot: python3 tools/tripo/motion.py krut:66e10fd9-0838-44e4-bea8-c889f60b9456 shieldshoot 3 soldier stands behind a heavy ballistic shield held with the left arm, leans the pistol in the right hand out past the right edge of the shield and fires three shots, then pulls back
код 0, 18 с, кредитов 20.0
```
движение «shieldshoot»: «soldier stands behind a heavy ballistic shield held with the left arm, leans the pistol in the right hand out past the right edge of the shield and fires three shots, then pulls back», 3 с
motion/generate: {"task_id": "1df956b7-4ff0-4494-be6a-ee7ad4ceef65", "status": "queued", "submitted_at": "2026-11-13T21:15:37.182977Z", "expires_at": "2026-11-13T21:20:37.182977Z", "asset_id": null, "error": null}
  движение: success 
asset_id: 4dd70928-84af-475e-b247-3f8b5ea82bd7
retarget: 5da26d42-7efd-4af3-96a9-f7ac05799d8c
  5da26d42: queued 0
  5da26d42: success 100
  e0c09953: queued 0
  e0c09953: success 100
готово: out/m_krut_shieldshoot.glb (2.0 МБ)
```

### p11_mot_flash: python3 tools/tripo/motion.py krut:66e10fd9-0838-44e4-bea8-c889f60b9456 flash 2 soldier pulls the pin of a grenade and throws it underhand forward, then turns his head away and crouches slightly
код 0, 23 с, кредитов 20.0
```
движение «flash»: «soldier pulls the pin of a grenade and throws it underhand forward, then turns his head away and crouches slightly», 2 с
motion/generate: {"task_id": "c127db6f-ab45-4c52-b13b-206107151598", "status": "queued", "submitted_at": "2026-11-13T21:16:25.788666Z", "expires_at": "2026-11-13T21:21:25.788666Z", "asset_id": null, "error": null}
  движение: success 
asset_id: f71142eb-1a98-4a61-9710-7678c7c665e4
retarget: c97d8dc3-b782-46c7-a883-baa761e6355f
  c97d8dc3: running 99
  c97d8dc3: success 100
  a5a907f1: queued 0
  a5a907f1: running 67
  a5a907f1: success 100
готово: out/m_krut_flash.glb (2.0 МБ)
```

### p11_mot_macherun: python3 tools/tripo/motion.py krut:66e10fd9-0838-44e4-bea8-c889f60b9456 macherun 2 angry fighter sprints forward with a machete raised in the right hand, left arm pumping
код 0, 24 с, кредитов 20.0
```
движение «macherun»: «angry fighter sprints forward with a machete raised in the right hand, left arm pumping», 2 с
motion/generate: {"task_id": "2da0ce29-16df-4d18-9e31-c9e536f3a848", "status": "queued", "submitted_at": "2026-11-13T21:17:34.499497Z", "expires_at": "2026-11-13T21:22:34.499497Z", "asset_id": null, "error": null}
  движение: success 
asset_id: ae82b4aa-708a-4ff2-8a2c-42af21bb7e7e
retarget: 74e109f1-604f-46b0-8cb7-4b42cc0ff885
  74e109f1: queued 0
  74e109f1: success 100
  d64578e9: queued 0
  d64578e9: running 6
  d64578e9: success 100
готово: out/m_krut_macherun.glb (2.0 МБ)
```

### p11_mot_machehit: python3 tools/tripo/motion.py krut:66e10fd9-0838-44e4-bea8-c889f60b9456 machehit 2 fighter swings a machete diagonally downward in a powerful two step strike, then recovers to a ready stance
код 0, 28 с, кредитов 20.0
```
движение «machehit»: «fighter swings a machete diagonally downward in a powerful two step strike, then recovers to a ready stance», 2 с
motion/generate: {"task_id": "ee2ea738-7a18-417f-bfa8-10d27260aa4f", "status": "queued", "submitted_at": "2026-11-13T21:18:24.562134Z", "expires_at": "2026-11-13T21:23:24.562134Z", "asset_id": null, "error": null}
  движение: success 
asset_id: 709d6720-31b1-454a-9d92-c654805f4a91
retarget: fa4bcb9b-8245-479c-9c50-898fc83575e0
  fa4bcb9b: queued 0
  fa4bcb9b: success 100
  55e26e85: queued 0
  55e26e85: running 99
  55e26e85: running 99
  55e26e85: success 100
готово: out/m_krut_machehit.glb (2.0 МБ)
```

### p11_mot_warcry: python3 tools/tripo/motion.py krut:66e10fd9-0838-44e4-bea8-c889f60b9456 warcry 3 gang leader raises his right fist high and shouts a battle cry rallying others, chest out, then points forward
код 0, 19 с, кредитов 20.0
```
движение «warcry»: «gang leader raises his right fist high and shouts a battle cry rallying others, chest out, then points forward», 3 с
motion/generate: {"task_id": "2697f90b-675b-43b6-a406-aa4427ddcb37", "status": "queued", "submitted_at": "2026-11-13T21:19:19.016674Z", "expires_at": "2026-11-13T21:24:19.016674Z", "asset_id": null, "error": null}
  движение: success 
asset_id: edcd4f66-d202-410d-9fd1-994257b1b08c
retarget: e6c9ddee-ee80-4fd3-b26c-20544b991a87
  e6c9ddee: queued 0
  e6c9ddee: success 100
  8df6408e: queued 0
  8df6408e: success 100
готово: out/m_krut_warcry.glb (2.0 МБ)
```

### p11_bal1: tripo account balance
код 0, 0 с, кредитов 0.0
```
Credits: 8145
Membership: premium
Subscription: premium (monthly)
```

Стоп по jobs.json — задания не выполняются

## Баланс в конце: 8145.0 (потрачено 1495.0)
