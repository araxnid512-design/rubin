## Баланс на старте: 22250.0
```
Credits: 22250
Membership: premium
Subscription: premium (monthly)
```

### q_st_safe_img: python3 tools/tripo/chain.py --id st_safe --image tools/tripo/refs/st_safe.png --faces 8000 --tex detailed --geo detailed --pbr --prompt heavy steel vault safe, closed door with a large spoked locking wheel, electronic keypad, massive hinges, yellow and black hazard stripes, worn dark grey metal
код 0, 146 с, кредитов 55.0
```
$ tripo generate image tools/tripo/refs/st_safe.png --prompt heavy steel vault safe, closed door with a large spoked locking wheel, electr... --face-limit 8000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/st_safe.glb
OK: Task created: 37857fa2-fcdb-4311-85f4-94a11a4dde72
OK: Generation complete
OK: Downloaded: out/st_safe.glb (4.9 MB)
$ tripo project list --size 1 --output-format json
{"total":77,"projects":[{"project_id":"aef2c0f6-1ba9-463e-9cfc-fb52c47e5b8a","project_name":"heavy steel vault safe 3d model","operator":{"operator_id":"37857fa2-fcdb-4311-85f4-94a11a4dde72","status":"success","type":"image_to_model","created_at":1794986530}}]}
ПРОЕКТ st_safe: aef2c0f6-1ba9-463e-9cfc-fb52c47e5b8a
{"id": "st_safe", "steps": [["generate", 0]], "pid": "aef2c0f6-1ba9-463e-9cfc-fb52c47e5b8a"}
```

### q_st_safe_open: python3 tools/tripo/chain.py --id st_safe_open --image tools/tripo/refs/st_safe_open.png --faces 8000 --tex detailed --geo detailed --pbr --prompt heavy steel vault safe with the door wide open to the right, metal shelves inside with ammo boxes, tins and a red first aid case
код 0, 191 с, кредитов 55.0
```
$ tripo generate image tools/tripo/refs/st_safe_open.png --prompt heavy steel vault safe with the door wide open to the right, metal shelves in... --face-limit 8000 --visibility private --texture-quality detailed --geometry-quality detailed --pbr --timeout 25m --output-format json -o out/st_safe_open.glb
OK: Task created: 98aa1307-a5bb-4711-8b97-4535e05f7a28
OK: Generation complete
OK: Downloaded: out/st_safe_open.glb (4.9 MB)
$ tripo project list --size 1 --output-format json
{"total":78,"projects":[{"project_id":"f810f53b-6aca-4ffb-a191-353f3e8c2ec4","project_name":"heavy steel vault safe 3d model","operator":{"operator_id":"98aa1307-a5bb-4711-8b97-4535e05f7a28","status":"success","type":"image_to_model","created_at":1794986677}}]}
ПРОЕКТ st_safe_open: f810f53b-6aca-4ffb-a191-353f3e8c2ec4
{"id": "st_safe_open", "steps": [["generate", 0]], "pid": "f810f53b-6aca-4ffb-a191-353f3e8c2ec4"}
```

Стоп по jobs.json — задания не выполняются

## Баланс в конце: 22140.0 (потрачено 110.0)
