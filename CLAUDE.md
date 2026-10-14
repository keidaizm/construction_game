# CLAUDE.md

## プロジェクトの目的

6 歳前後の子どもが家庭で遊ぶ、3D 建設機械シミュレーター。
ショベルカー・ダンプカー等をレバーやジョイスティックで操作し、岩を運んだ結果として
1〜10 の足し算を自然に学べる（例：2 個＋3 個運んだ → `2 + 3 = 5` でクリア）。
算数のためにゲームを中断せず、「建機で運んだ結果が算数になる」体験を目指す。

**最優先：6 歳児が「ショベルカーを自分で動かしている！」と感じられる操作体験。**

## 対象ユーザー・端末

- 6 歳前後。文字が読めなくても分かる UI（矢印・絵・色）にする
- 10 インチ程度の Android タブレット、横画面、タッチ操作
- まず Chrome で動く Web アプリ。将来 PWA または Capacitor で Android アプリ化を検討
- PC 開発用にキーボード操作もある

## 技術構成

- React 19 + TypeScript + Vite
- three + @react-three/fiber（3D）
- zustand（入力・ゲーム状態）
- @react-three/rapier（物理。Phase 2 で導入）
- 未導入：`@react-three/drei` は GLB 読み込み（useGLTF）などが必要になったら導入
- 過剰なライブラリ導入は避ける

## 設計方針

- **役割ごとにディレクトリを分ける**：`vehicles/` `cargo/`（岩などの積載物） `physics/` `controls/` `stores/` `camera/` `world/` `audio/` `components/ui/`。
  `missions/`（おきば・道案内・設定）。App.tsx に車両固有ロジックを置かない
- **入力は共通の操作軸**（`stores/inputStore.ts`：driveX/driveY/swing/boom/arm/bucket/bed、-1〜1）。
  タッチとキーボードは別ソースとして保持し、`readAxes()` で合成。各車両は自分に関係する軸だけ読み、
  **乗っていない車両（`gameStore.activeVehicle` 以外）は入力をゼロにする**（当たり判定などの更新は続ける）
- **乗り換え**：`gameStore.switchVehicle()`（のりかえボタン／V キー）。切替時にタッチ入力をリセット。
  操作パネル（`components/ui/`）・カメラの視点プリセット・太陽光の追従先が乗っている車両に合わせて切り替わる
- **毎フレームの処理は useFrame 内で ref を直接書き換える**。React の state を毎フレーム更新しない
  （`readAxes()` は `getState()` を使うので再レンダーしない）
- **車両は「関節 Group」と「見た目」を分離**：コントローラは関節 Group の transform だけを操作し、
  見た目は `parts/*Model.tsx`。GLB 差し替え時は見た目だけを置き換える
- 車両の寸法・可動範囲・速度は `excavatorConfig.ts` / `dumpTruckConfig.ts` / `bulldozerConfig.ts` のような config に集約する
- **車両共通のものは `vehicles/shared/`**：油圧の関節（`joint.ts`：approach / stepJoint）、HydraulicCylinder、Beam、materials、RigListener、
  車両どうしの接触判定（`footprints.ts`：足元を円で近似。kinematic なので物理では止まらないため）、
  バケットが入れない床（`digFloors.ts`：ダンプの荷台の床を毎フレーム登録、ショベルがバケット先端の真下を問い合わせる）
- 座標系：車両ローカルは +Z 前、+Y 上、+X 左。関節角度は「親に対する仰角」（+ で上）、`rotation.x = -angle`
- 物理演算が不安定になりそうなら、無理に完全な物理にせず補助ロジックでゲームとしての安定を優先する。
  実例：`useBucketGrab.ts`。口が上〜横向きのときバケット内の領域に入った岩を kinematic にしてスロットへ追従させ、
  「開けば落ちる」を優先し、口の向きに関係なく、開く操作中に開き具合 30% 超／開き具合 60% 超／口が下向き、で dynamic に戻して落とす
  （ブームを上げてアームを引いた姿勢では、開いても口が上を向いたままなので、向きだけの判定だと落ちなかった＝ユーザー指摘）。
  バケットを開いている間（spilling）は、こぼした岩に限らずバケットの中・まわり（背中・ふち）の free の岩を、出るまで流し出す
  （口が上向きなら横＋上へ）。閉じたら流し出しをやめてすぐすくえるようにする。車体の上に落ちて止まった岩は外へ滑り落とす
  すくう動き（アームを引く・バケットを巻き込む＝excavatorSensors.scooping）の間は、口の前の free の石を口の中へ引き寄せる
  （速さ・範囲はバケットの大きさに比例。ユーザー指摘「大きいバケットだと取りにくい」。Lv3 で 1 回の平均 1.3 → 2.7 こ）。置いた直後に近づけるだけでは引き寄せない
  （ユーザー指摘「開いても落ちないことがある」＝掘って出た岩や、アームを引いた姿勢でこぼして車体に乗った岩が残っていた）。その間は再びすくわない。判定は子ども向けに甘め（横はみ出し・口の外の帯も含む）。
  こぼすときバケットの勢いは 25% だけ引き継ぎ、バケットから出た瞬間にダンプの荷台の近く（1.2m 以内）なら落下先を荷台の中へ寄せる
- ダンプの荷台も同じ考え方（`useBedCargo.ts`）：荷台が下りていて停車中、荷台内で落ち着いた岩を kinematic で荷台に固定。
  荷台 15° 超で dynamic に戻し、28° 超では荷台から出るまで後ろへ最低 1.2m/s で押す（床の後端の角で釣り合って止まるため）
- **関節更新の直後に走る処理は RigListener**（`vehicles/shared/rig.ts`）としてコントローラの useFrame 末尾でまとめて呼ぶ
  （油圧シリンダー・当たり判定ボディの追従・すくい判定・荷台の積み下ろし）。1 フレームの遅れを出さないため
- 車両の当たり判定は関節階層の外（シーン直下）の kinematic ボディとし、関節の matrixWorld から毎フレーム姿勢を設定する
  当たり判定の大きさは見た目に合わせる（ユーザー指摘「すき間があるのに石を押す」＝履帯の箱が前後に 0.37m 長かった。バケットの板も見た目の厚さに、爪にも当たり判定）
- 物理は `timeStep="vary"`（描画 1 フレーム = 1 ステップ）。固定ステップ＋補間だとバケットに追従する岩がずれて見えるため
- 毎フレーム読む共有状態は React state にしない：`rockRegistry`（岩の一覧と状態 free / held / truck）、
  `excavatorSensors`（バケット先端など）、`dumpTruckSensors`（荷台の角度・載っている岩の数など。Phase 4 の数え上げに使う予定）
- **探検と色の石**（ユーザー提案）：岩は色（`RockColor`：gray/black/red/white、`rockTypes.ts`）を持ち、
  置き場は `cargo/rocks/rockSites.ts`（色ごと 2 か所・各 9 こ。スタート＝フィールド中心のまわりには置かず、中心から 105〜135m の輪の上に
  方角ごとに色が変わるように並べる＝ユーザー要望）。`RockField` が全置き場を描く。
  フィールドの配置（木・大きな岩・目印・走れる範囲 ±170m）は `world/fieldLayout.ts` にまとめ、3D と地図で共有。
  木・岩・建物は footprints の静的な障害物で、車両がぶつかると止まる
- **色別ミッション**：`missionStore.parts`（[{color, count}]）。`levels.ts` の `pickMission` がレベルの合計範囲・色数から作る。
  判定は色ごとにぴったり。**ミッションにない色はおきばに入っていても数えない（無視）**（ユーザー指摘：白のミッションで掘って出た色の石がまざると
  「ふつうの いしが 3こ おおい」とだけ出て分かりにくかった）。式・delivered もミッションの色だけで作る。ほかの色があれば「（ほかの いろは かぞえないよ）」。式は色が 2 つ以上なら色ごとの数、1 色なら運んだ回ごと
- **道案内**：`CompassArrows`（足りない色ごとに 1 本、その色のいちばん近い free の岩を指す。おきば・荷台・バケットの分を差し引く）＋
  積んだダンプの上の緑の矢印（`GuideArrow`）。矢印の形は `arrowGeometry.ts` で共有
- **地図**：`MapOverlay`（画面いっぱい・タップで閉じる・M キー）。`explorationStore`（20m マス、車両の周り 35m を行ったことにする、localStorage 保存）。
  座標は「スタートの前 = 上」、画面 x = −ワールド x（車両ローカルの +X が左のため）
- **音**（`audio/webAudio.ts`）：効果音ファイルなしで Web Audio 合成。エンジン（のこぎり波＋矩形波＋ローパス＋低周波で音量をゆらす）、
  油圧（帯域ノイズ＋三角波）、石（ノイズ＋正弦波の短い音）、ファンファーレ等。最初の pointerdown/keydown で AudioContext を作る。
  エンジン・油圧は「乗っている車両のコントローラだけ」が更新する（乗っていない車両が上書きしないように）。ミュートは localStorage。
  ほかのアプリ・タブ・ウィンドウに切りかえたら（visibilitychange hidden・blur・pagehide）AudioContext を suspend、戻ったら resume（ユーザー要望）
- **掘る・鉱石・図鑑**：土の山（`cargo/dirt/`、6 か所・5×5 列・最大 3 段＝35 ブロック）は列ごとの高さで持ち、見た目は InstancedMesh、
  石が乗れるよう列ごとに固定コライダー。バケットの先が列に入ると上のブロックを崩す（`useBucketDig`、0.15 秒に 1 こまで）。
  出るもの `rollDrop()`（鉱石は `cargo/ores/oreTypes.ts` の weight [%]）。出てくる石は控えの岩（`RockState 'pooled'`、遠くに kinematic で止めてある）を
  `rockRegistry.spawn` で出す（遊んでいる最中に物理ボディを作らない）。図鑑は `collectionStore`（localStorage）。演出は `effects/DigEffects.tsx`
- **昼・夕焼け・夜**（ユーザーの息子さんの提案。最初は昼夜の 2 つ→「夕焼けも手動で」で 3 つに）：`gameStore.timeOfDay`（'day' | 'dusk' | 'night'、ボタン／N キーで順に回る、保存しない）。
  `world/DayNight.tsx` が `dayNight.darkness`（`dayNightState.ts`、昼 0・夕焼け 0.5・夜 1 へ向かって進む。0→1 で約 3 秒）を進め、
  空・霧の色（昼 → 夕焼け → 夜）と星（Points 1 つ）・月を出す。`SunLight` が同じ値で太陽光を月明かり（うっすら見える）に変える。
  ライトは `gameStore.headlights`（夕焼け・夜、H キー、昼に戻ると消える。明るさは darkness に比例）。`world/Headlights.tsx` の SpotLight 1 つを乗っている車両の前へ動かす
  （ショベルは `excavatorSensors.cabHeading`）。**光源の数・visible を変えるとシェーダーが作り直されて止まるので、いつも置いて明るさだけ変える**。影なし。
  時間帯だけの鉱石は `OreType.onlyAt`（'dusk' | 'night'、`rollDrop(timeOfDay)`）。昼夜・ライトのボタンは右上（のりかえボタンの左。ミッションの札と重ならない位置）
- **地帯**（`world/biomes.ts`）：基地（半径 45〜75m で混ざる）と、方角ごとに 雪原（北 +Z）・岩山（西 +X）・砂漠（南）・森（東 -X）。境目は ±12° でぼかす。
  地面は `groundGeometry.ts`（130 分割、頂点カラー＝地帯の色 ÷ 模様の明るさ、灰色の模様テクスチャと掛け合わせ）。木（種類 pine/snowPine/round/cactus/palm）・大きな岩・砂利の色・遠くの山の色も地帯で変わる。
  木と木の間はダンプが通れるくらいあける（ユーザーの息子さんが運転できるように。森は多めでも詰めすぎない）
- **池・川・橋**（`world/waterLayout.ts`・`Water.tsx`）：水は footprints の障害物の円（川は 2.5m おき）。橋の所だけ円をあける（橋の中心から 6.2m）。凍った池は障害物なし。
  水の中の石は `RockField` が置き場に戻す。橋の前後 16m は木を置かない
- **丘**（`world/terrain.ts`）：`HILLS`（遊びに使う場所から離して自動配置）と `heightAt(x, z)`。見た目の地面と、石用の当たり判定（丘の三角形だけの Trimesh、`PhysicsWorld`）は同じ形。
  丘の Trimesh は ORIENTED＋FIX_INTERNAL_EDGES（中は固い）。厚みのない面だと、押し込んだ石が丘の中へすり抜けた（ユーザー指摘）。
  念のため `RockField` が 0.5 秒ごとに、中心が斜面より下の free の岩を斜面の上へ出す。
  車両は `vehicles/shared/terrainPose.ts` で高さと前後・左右の傾き（rotation の順 YXZ、rotation.y は向きのまま）。ショベルの掘れる深さもその場の地面から。
  車両の上に出す矢印・札・ライトは車両の y を足す
- **宝の山**（`dirtConfig.ts` の `TREASURE_MOUNDS`・`ALL_MOUNDS`）：地帯ごとに 1 こ、中心から 152m。`rollDrop(time, treasure)` で ★3 以上 ×3、`OreType.onlyIn` の地帯の鉱石 4%
- **名所・宝箱**（`world/discoveryLayout.ts`・`Discoveries.tsx`・`stores/discoveryStore.ts`、localStorage）：名所は近づくと（24m）発見、宝箱は車両の足元の円が触れると開く
  （`footprints.footprintTouches`）。宝箱 8 こは InstancedMesh 4 つで描く。全部開けたら 6 秒後に全部閉じる（chestRound）。図鑑に「はっけん」タブ。
  かざぐるまは合う絵文字がないので `SightIcon` で SVG を描く
- **地図の未開の場所**：灰色の雲＋「？」の SVG パターン、走れる範囲の外は山の色、左上に探検の割合（`explorePercent`）。
  100% で `MapCompleteOverlay`（花吹雪・星 +5、1 回だけ＝`explorationStore.completeRewarded`。ユーザー判断：ごほうびは星、途中のお祝いはなし）
- **油圧ブレーカー**（Lv4＝星 36、ユーザー提案。`missions/levels.ts` の `BREAKER_LEVEL`）：`gameStore.excavatorTool`（'bucket' | 'breaker'、`ToolToggle`・B キー）。
  ブレーカーはバケットの関節に `BreakerModel`（倍率なし、先 `BREAKER_TIP`）、当たり判定も細長いものに作り直す。ブレーカーの間は `useBucketGrab`（持っていた石は落とす）と `useBucketDig` は動かない。
  大きな岩（`world/boulders.ts`・`BoulderField.tsx`）は割れるので STATIC_OBSTACLES から外し、動く障害物＋digFloors（`noLanding`：こぼした石を寄せる対象にしない）に登録。
  `useBreaker`：のみの先が岩のだ円体（×1.2）に入っている間、自動で叩く（ユーザー判断）。叩いた秒数で hp が減り、0 で割れる（大きさ×2.2 秒）。
  割れると地帯の色の石 3〜5 こ（控えの岩を spawn。控えは 14/8/8/8 に増やした）＋ `fromBoulder` の鉱石（ジオード 30%・いんせき 16%・ほしのかけら 7%）。resetToken で全部戻る
- **大きいショベル（Lv5、`LevelConfig.excavatorScale` = 1.3）**：ルートの Group を拡大し、先のアタッチメントは倍率で割って元の大きさのまま（バケットは bucketScale）。
  当たり判定（履帯・上部・ブーム・アーム）は倍率をかけて作り直す（key）。足元の円・傾き・履帯の送り・車体に乗った石の判定・ライトの高さ・コンパスの輪・カメラの距離も `excavatorSensors.scale` で合わせる
- **重ダンプ（Lv5、`BIG_TRUCK_LEVEL`）**：ダンプの寸法は `dumpTruckConfig.ts` の `TRUCK_SIZES`（standard／big）。`DumpTruck` がレベルで選んで `truckShape.current` に入れ、
  コントローラ・`useBedCargo`・荷台の札は毎フレームそれを読む（作り直さないので、レベルが上がっても位置はそのまま）。当たり判定は key で作り直す。
  見た目は `BigTruckBody`・`BigBedModel`。荷台のふち 2.73m（ショベルのバケットは荷台の上で 3.2m 以上まで上がる＝ユーザー要望「荷台が高くなりすぎないよう」）
- **木をたおす（Lv5＝星 44）・グラップルと家（Lv6＝星 52）**（ユーザー提案。`FELL_LEVEL`・`GRAPPLE_LEVEL`）：
  倒せる木（`fieldLayout` の `FELLABLE_TREES`：外がわの地帯、サボテン・ヤシ以外）は STATIC_OBSTACLES から外し、`world/forest.ts`（状態）・`TreeField.tsx`（見た目・動く障害物）。
  ブルドーザーの排土板の円が木に触れたまま前へ 0.6 秒 → 倒れる（ブルドーザーの向きへ）→ 木材 3 本 → 20 秒後に同じ地帯の木の少ない所（`findRegrowSpot`）に生える。
  木材は `cargo/logs/`（控え 30 本を遠くに止めて使い回す。Lv6 未満は 30 秒で消える）。
  木材は車両に重ならない所に出す（`clearLogSpot`：倒したあとも進むブルドーザーの中に出て、排土板と車体にはさまった＝ユーザー指摘）。
  ブルドーザー・ショベルの車体の上に乗った木材は外へすべらせる（`touchingFootprint`。ダンプは荷台に積むので対象外）。ダンプの荷台は岩と木材の両方を運ぶ（`useBedCargo` の Cargo。札・ミッションは岩だけ数える）。
  グラップル（`excavatorTool` 'grapple'、`availableTools(level)` の順に回る）：バケットの関節をいつも真下にぶら下がる角度にし、バケットのレバーはつめの開閉（`excavatorSensors.grappleOpen`）。
  閉じたときにまん中 1m 以内の木材を kinematic でつかむ（`useGrapple`）。家（`world/BuildSite.tsx`・`buildSiteLayout.ts`・`stores/houseStore.ts`）：
  `BUILD_SITE`（基地の +X がわ＝地図で基地のすぐ左。ユーザー指定で (48, 9) に移した）の区画 6 つ（2 列 × 3、地図の上下に並ぶ）、黄色い輪に止まった木材を 1 本ずつ使う。
  12 本で完成・星 +3。家・倒れる木は InstancedMesh で、あとから形が変わるので frustumCulled を切る（最初の範囲のままだと描かれない）
- **基地**（`src/base/`、ユーザー提案）：フィールドの建物は前からの事務所だけ（ユーザー判断：車庫・工房・展示棚は 3D に置かない）。
  近づくと「じむしょに はいる？」→ `gameStore.baseRoom`（office のメニュー → workshop／garage／showcase）。画面は `components/ui/BaseRooms.tsx`。
  クラフト：`craftRecipes.ts`（ペンキ・かざり）、`stores/craftStore.ts`（持っているもの・車の色）、`collectionStore.held`（持っている鉱石。図鑑の counts とは別、クラフトで減る）。
  車の色は `useVehiclePaint`（その車両の中の共有 paintYellow を、車両ごとの材料に入れかえ、部位の材料の色もそろえる）。環境マップがないので metalness は 0.4 まで
- **ビルこわし・ふるい・てっこつ（Lv7＝星 60、ユーザー提案。`DEMOLISH_LEVEL`）**：Lv7 になると `GameCanvas` が `DemolitionSite`・`ScrapField` を出す。
  場所は `world/demolitionLayout.ts`（ビル (12, −66)＝地図の下、リサイクル場＝緑の場所 (18, −28)・半径 5。まわりの木・岩は `nearDemolition` で後から取りのぞく＝乱数の進み方を変えないため。丘も置かない）。
  ビル（`world/demolition.ts`）：3 階。ブレーカーの先が箱（＋0.7m）に入っている間 `hitBuilding`、1 階 3 秒で上から 1 階ずつこわれ、がれき 2 こをショベルのいる側の外に出す
  （のみの先はビルの中まで入るので、先ではなくショベルの位置で決める）。全部こわれて 30 秒（車両が跡地にいなければ）で元に戻る（ユーザー判断）。
  階ごとの kinematic の当たり判定（こわれた階は地面の下へ）・動く障害物・digFloors（屋上）。
  がれき（`cargo/scrap/`、控え 16）：mixed（コンクリートつき）／steel（鉄骨だけ）。スケルトンバケット（`excavatorTool` 'skeleton'、`useSkeletonBucket`・`SkeletonBucketModel`、大きさは bucketScale）で
  すくい（3 こまで、石はすくわない）、バケットのレバーで開く⇄閉じるの向きが 6 回変わると steel（ユーザー判断：レバーでゆらす。小石は `digEffects.pebbles` の見た目だけ）。
  こぼすのは口が下向き、または開くレバー中に開き具合 60% 超だけ（ふるうときにこぼれない・大きく開いた所から巻き込んですくえるように。`excavatorSensors.bucketLever`）。
  ダンプの荷台はがれきも運ぶ（`loadedScrap`/`loadedSteel`、鉄骨だけなら緑の矢印がリサイクル場へ）。リサイクル場で止まった steel を 1 本ずつ数える（mixed はお知らせだけ）。
  お題（`stores/scrapStore.ts`、localStorage）：「てっこつを 3〜6 ほん あつめよう」、3 秒以内に数えた分は同じ回（式 2 + 1 = 3）、クリアで星 +2・`SteelClearOverlay`。
  持っている てっこつ（`steel`）は Lv8・9 の塔・ビルづくりで使う予定。ビル・リサイクル場の近く（40m／22m）か、がれきを積んだダンプでは `MissionBanner` のかわりに `SteelBanner`（いまの手順も出す）。
  がれきの位置・ビルのこわれ具合は途中セーブに入れていない（読みこむとビルは元どおり、がれきは消える）
- **ビル（Lv8＝星 68）・タワー（Lv9＝星 76）づくり**（ユーザー提案。`OFFICE_LEVEL`・`TOWER_LEVEL`）：工事現場は基地の東（`world/cityLayout.ts`、`CITY` (−54, 28)＝地図で基地の右。`nearCity` で木・岩・丘をのぞく）。
  `CitySite.tsx`（Lv8 から GameCanvas が出す）：黄色い輪（資材置き場）で止まった石を 1 こずつ使い（`rockRegistry.despawn`＝元の置き場へ戻る。金色はのぞく）、
  ビルは石 4 ＋ てっこつ 1 で 1 階（4 階で完成・星 +3、区画 3 つ）、タワー（東京タワー風、赤と白の鉄骨 `cityModels.ts` の latticeGeometry）は石 3 ＋ てっこつ 2 で 1 段（6 段で完成・星 +5）。
  てっこつは持っている分（`scrapStore.spendSteel`）から自動で使う。足りなければ石を取らずに待つ（看板の数が赤・`CityBanner` で「てっこつが たりない」）。
  つぎにできる所はうっすら（ghost）、建てている階は鉄骨の骨組み。夜は窓・タワーの色の明るさだけ上げてライトアップ（光源は増やさない）。記録は `stores/cityStore.ts`（localStorage）。
  資材置き場の近く（26m）では `CityBanner`。石を積んだダンプが工事現場の近く（45m）なら緑の矢印が資材置き場を指す。レベル一覧は開くと いまのレベルの行まで送る
- 走る速さの切り替え（カメ／ウサギ）は**なくした**（ユーザー判断「あまり使わない」、全車両）。速さはいつも前の「ウサギ」の値
- 次（未着手・ユーザーとブレスト中）：さらに上のレベルでペンキで色をぬる（タワー・ビルのカスタマイズ）、Lv10 でピラミッドをこわして地下の迷路ダンジョン（ミイラ・黄金の秘宝）。建築資材のクラフト（鉄→てっこつ、銅→どうせん、黒＋白の石→コンクリートなど）と、別マップの「街づくりワールド」
- **タワークレーン**（`vehicles/crane/`、ユーザー提案「Lv3 以上でクレーンを操作・ミニゲーム」）：VehicleId 'crane'（のりかえの順番には入れない）。
  車両で 18m 以内に近づくと `CraneBoardPrompt`（Lv3 未満は鍵）→ `gameStore.boardCrane()`（previousVehicle を覚え、`leaveCrane()` で戻る）。
  操作：swing＝旋回、arm＝トロリー、boom＝巻き上げ、つかむ／はなすはボタン（`craneStore.pressGrab`、F キー。ユーザー判断：自動ではなくボタン）。
  揺れは少しだけ（振り子、4.5° まで）。荷物はつかむと kinematic でフックの下、はなすと dynamic（勢いは 1.2m/s まで）。
  フック（と荷物）は真下へ光線を飛ばし、地面・荷物より下へ下げない。下ろしきる手前ではなすと下のもの（ブロック・土台・台）にそろえる手助け。
  カメラは腕に直角な横から（ユーザー要望「横から見ながら」。`cameraAnchor` をトロリーの下に置く）。奥行きが分かりにくいので、道具は腕の向き（放射状）に並べ、
  車両が近づく北東（0〜115°）はあける（`craneYard.ts`）。置き場 22m は木なし・丘なし。
  ミニゲーム（`CraneGames.tsx`・`stores/craneStore.ts`）：コンテナはこび（式の答えのコンテナを台に。止まって 0.6 秒で判定、せいかい★+1。
  式はレベルで増え、出せる種類から毎回ランダム（ユーザー要望「ずっと同じ種類ではなく」）：はじめは答え 10 までのたし算、Lv4 から 2けたの たし算、Lv6 から ひき算（1けた・2けた）、
  Lv8 から 1けたの かけ算（`CRANE_ADD2_LEVEL` など）。答えは 1〜99。まちがいのコンテナは答えの近くの数と、よくあるまちがい（ひき算・かけ算で たしたなど））、
  つみきタワー（土台から 4.5m 以内で止まっているブロックの一番上、さいこう記録は保存、1m ごとに★+1）。乗っている間はミッションの札のかわりに `CraneBanner`
- **ミッションの種類**（`levels.ts` の `pickMission`）：carry（はこぼう）／make（◯を つくろう：合計ぴったり＋2 色以上）／
  remove（とりのぞこう：はじめの石を DeliveryZone が並べ `needsSetup`、目標まで減らす。とりすぎは wasOver）。
  色ごとの残りは `remainingFor(mission)`（carry は色ごと、ほかは合計）。最初のミッションは carry
- **金色の石**（`missions/goldTreasure.ts`・`GoldBeacon.tsx`）：ミッションごとに 50% で出る。RockColor 'gold'（ROCK_COLOR_ORDER には入れない＝ミッション・矢印の対象外、
  おきばでも数えない）。バケットに入ったら星 +1 して控えに戻す。光の柱で遠くから見える
- **ミッションの数え方**：岩は落とされた回ごとに `batchId` を持つ（バケットのこぼし始め／荷台の荷下ろしのたびに `rockRegistry.nextBatchId()`）。
  おきば（`missions/DeliveryZone.tsx`、中心 (4.6, 31)・半径 5、数える範囲は半径 7）で止まった free の岩を `delivered` にして
  `missionStore.deliver(batchId)` → 同じ batchId をまとめて 1 つの数にし、`2 + 3 = 5` の式を作る。
  **数え方**：岩に「運び終わった」状態は持たせず、0.2 秒ごとに「いま円（半径 6.5、見た目どおり）の中にある free の岩」を数え直して
  `setZoneContents(batchIds)`（転がり出たら減る＝ユーザー指摘のバグ修正。以前は一度止まった岩を固定し、円より広い半径 7 で数えていた）。
  **ぴったりルール**：中身が変わってから 1.5 秒変化がなく、おきば付近に動いている岩もなくなってから `judge()`。
  ぴったり → cleared（星）。多すぎても失敗にせず playing のまま「N こ おおい！ショベルで とりのぞこう」（ユーザー提案）。
  ショベルがおきば付近でバケットに岩を持っている間は確定しない（置き終わってから）。星は「おおすぎずに できた」（wasOver）
- 多く積みすぎたら減らせるよう、ショベルは荷台の岩（state truck）もすくえる（`useBedCargo` は state が truck でなくなった岩を記録から外す）。
  荷台の上の札（`TruckCargoBadge`）は残りより多いと赤「おおい」、そのとき荷台の岩にも黄色い ▼
- **星とレベル**（`progressStore` を zustand persist で localStorage 保存、`levels.ts`）：星 = クリア＋やり直しなし＋2 回以上に分けて運んだ。
  Lv1(0★)：バケット×1・3 こ・目標 3〜5 ／ Lv2(9★)：×1.3・5 こ・5〜10 ／ Lv3(24★)：×1.6・8 こ・10〜20。
  バケットは Group の scale（すくい判定は逆行列でローカルに戻すので形の定義はそのまま）、当たり判定は倍率を掛けて作り直す。
  スロット配置は `BUCKET_SLOTS_BY_CAPACITY`。岩置き場の数もレベルで増える（18 / 22 / 30）
- **ミッションの表示**（`MissionBanner`）：左に「あと ◯こ」（多すぎは「おおい ◯こ」、ぴったりは OK）、右にお題（`MissionFrame`）。
  2 色以上の「はこぼう」は色ごとの行を重ねず、チップ（岩・「2/3」・小さな丸）を横に並べる（ユーザー指摘：色が多いと上のまん中をとりすぎる）
- **レベルの一覧**（`components/ui/LevelGuide.tsx`、ユーザー要望）：左上の `ProgressBadge` を押す（`gameStore.levelsOpen`）。次のレベルまでの星のバーと、
  各レベルでできること（`PERKS`。レベルを足したらここにも書く）
- **途中の様子のセーブ**（`stores/sessionSave.ts`・`world/SessionKeeper.tsx`、ユーザー要望：何日かにわたって遊ぶ）：localStorage の `kenki-asobi-session`。
  ゲーム・ミッションの store は読みこんですぐ戻す（main.tsx で最初に import）。物理は準備ができてから：車両（`requestTeleport` に関節の角度も、`applyTeleport`）→ 4 フレーム後に石・木材・岩・木。
  荷台やバケットの石は少し上に free で置き、また載る。2 秒ごと・visibilitychange hidden・pagehide で保存。コントローラは `vehicleStates` に状態を出す。
  保存するものを足すときは `SessionSave` に足す（VERSION を上げると古いセーブは読まない）
- **グレードアップのお祝い**：`progressStore.shownLevel`（お祝いを見せたいちばん上のレベル、保存）。星をどこでもらっても（クレーン・金色の石・地図など）
  レベルが shownLevel より上なら `LevelUpCelebration` が `LevelUpCard` を出す（ユーザー指摘：クレーンで Lv4 になっても何も出なかった）。
  ミッションのクリア画面（そちらで同じカードを出す）・地図コンプリート（`celebrationStore`）の間は待つ。「やったね！」で shownLevel を上げる。
  前の版の記録は migrate で shownLevel を決める（Lv4 以上は 3 にして、ブレーカーのお知らせをもう一度見せる）
- 「はじめから」（resetToken）でミッションの進み具合も消える。「つぎへ」は次の目標に進めてから resetToken を上げる
- 岩の種類は `cargo/rocks/rockTypes.ts`（small / medium / large。現在は medium のみ使用）
- サウンドは `audio/AudioManager.ts` のインターフェース経由で呼ぶ（現状 no-op）
- **スワイプで視点を回せる**（`camera/useOrbitDrag.ts`）：キャンバス上のドラッグで yaw（回り込み）/ pitch（見下ろす角度 12〜72°）。
  注視点を中心に回す。2 回タップで戻す。走行入力中は少しずつ戻る。乗り換え・resetToken でも戻す。
  レバーは自分の要素で pointer capture しているので、キャンバスには届かず干渉しない（ユーザー要望：取るときの状態を見やすく）
- カメラは `camera/FollowCamera.tsx` の車両ごとの視点プリセット式。`gameStore.cameraMode` で将来切替。
  ショベルは右後ろから、ダンプは真後ろのやや左から（積み込み位置で右隣のショベルが視界をふさがないように）
  ブルドーザーは速さで視点が変わる（プリセットの `fast`）：ゆっくり・止まっているときは高く近く（排土板の前の石が見える）、
  速いときは低く遠く（前の方まで見える）。1.5〜5 m/s の間でなめらかに移る（ユーザー要望）

## パフォーマンス方針（Android タブレット）

- 安定して 30fps 以上を優先（理想 60fps）。高性能 PC 前提にしない
- dpr は最大 1.5。影は太陽光 1 灯のみ、影カメラは車両周辺だけに絞り追従させる
- 同じ物を多数置くときは InstancedMesh（履板・小石・コーン）
- マテリアルは共有（`vehicles/shared/materials.ts`）。テクスチャは Canvas 生成の小サイズ
- 岩は最初 10〜20 個程度。物理オブジェクト数・ドローコール・ポリゴン数に注意

## 開発フェーズ

1. ✅ **Phase 1** ショベルカー基本操作：フィールド・地面・簡易ショベルカー・カメラ・走行・上部旋回・ブーム・アーム・バケット・タッチ UI
2. ✅ **Phase 2** 岩の操作：岩オブジェクト（小・中・大を追加できる構造）・物理・すくう・運ぶ・落とす・すくえる岩の上に黄色い ▼ マーカー
3. ✅ **Phase 3** ダンプカー：積載・車両切替・運転・荷台 UP/DOWN・荷下ろし
4. ✅ **Phase 4** ミッション・算数：「岩を5個運ぼう！ 0 / 5」表示・カウント・足し算表示・クリア（星・紙吹雪も先に入れた）
5. **Phase 5** 演出：効果音・エンジン音・油圧音・UI 改善・クリア演出（星・紙吹雪）・3D モデル差し替え・Android 最適化

指示された Phase より先を勝手に実装しない。

## 3D モデル・素材のライセンス

無料・低価格モデルを想定。商用利用不可などの素材をリポジトリに直接含めない。
追加時はライセンスと出典を記録する。

## コマンド

- `npm run dev`：開発サーバー（`--host` 付きなので同じ Wi-Fi のタブレットから開ける）
- `npm run build`：`tsc --noEmit` + `vite build`
- `npm run typecheck`

## ユーザーの判断・フィードバック

- カメラは車体（クローラ）追従のままでよい。前方が隠れるときはキャブを横に向けて作業すればよい、とユーザー判断
- 地面の飾りの砂利は「取れる物」と紛らわしいので小さくし、岩置き場の周りには置かない
- 描画負荷の目安（開発時 `__game.renderer.info.render.calls`）：基地で全部見えているとき約 270（ブルドーザー追加後 約 316、地帯・水・名所の追加後 約 342）、離れると約 100。実機で要確認
- ユーザー要望「少しゲームが単調」→ 相談して 音 → 掘る・鉱石・図鑑 → ミッションの種類（つくろう・とりのぞこう・金色の石）の順に追加
- 走る速さ：ショベル 6.4 m/s（ユーザー要望「ショベルが遅い」）、ダンプ 13 m/s（「まだ遅い」）、ブルドーザー 5.5 m/s。
  前はカメ／ウサギの 2 段階だったが、あまり使わないのでなくした（ユーザー判断、2026-10-14）。ダンプは速いほどハンドルの切れ角を減らす（13 m/s で 40%）
- 「数量はぴったりがおもしろい」「星を集めてグレードアップ、足し算の数が増える」「遣り込み要素がほしい」→ 相談の結果、
  多すぎたら荷台からすくい出せる／グレードアップはバケット拡大＋数の範囲／数は 20 まで（Lv3 で繰り上がり）に決定
- 「積んだ後どこに持っていけばよいか分からない」「クリアした感覚がほしい」を受けて Phase 4 に進んだ。
  おきばはダンプの初期位置からまっすぐ前、三角コーンの道の先。岩を積んだダンプに乗っているとトラック上に緑の矢印
  （平たい矢印を先端側に少し起こしてある。円錐だと後ろからは丸にしか見えなかった）
- ブルドーザー（ユーザー提案「とりのぞこうミッションにブルドーザーがあると面白い」）：最初から使える。
  **土ブロックは壊せない**（簡単にブロックを壊して石を集められてしまうため。ユーザー判断）。石になったものは押せる。
  のりかえは ショベル → ダンプ → ブルドーザー の順に回る。排土板はレバー 1 本（U/J キー）
- ダンプはショベルの左側（キャブ側、x = 4.6）に置く。右側だとショベル用カメラの視界をふさぐ。
  バケットの届く範囲（持ち上げた姿勢で旋回半径 約 4.3m）に荷台の中心が来る位置

## 公開（PWA・Vercel）

- GitHub `keidaizm/construction_game`（public）→ Vercel（プロジェクト construction-game、GitHub 連携済み＝main に push で自動公開。https://construction-game-rho.vercel.app）。`vercel.json` で sw.js はキャッシュしない・/assets は長期キャッシュ
- サービスワーカーは手書き（`public/sw.js`、追加ライブラリなし）。本番だけ登録（main.tsx、`import.meta.env.PROD`）。
  install でトップページと、そこに書かれた /assets を保存。ページはネット優先、ファイルはキャッシュ優先。
  キャッシュの作りを変えたら `CACHE` の名前（v1）を上げる
- アイコンは public の icon-192/512/180.png（favicon.svg を空色の背景で書き出したもの）

## 開発用

- `?fps`：FPS 表示 / `?physics`：当たり判定の表示
- 開発サーバーでは `window.__game.crane`（craneStore）・`craneSensors`・`craneLoads` も見られる
- 開発サーバーでは `window.__game.teleport('dumpTruck', x, z, heading)` で車両を瞬間移動できる（自動テストで遠くを確かめる用。`vehicles/shared/devTeleport.ts`）
- 開発サーバーでは `window.__game`（`rockRegistry`, `excavatorSensors`, `dumpTruckSensors`, `bulldozerSensors`, `game`＝gameStore, `mission`＝missionStore, `progress`＝progressStore）で
  ブラウザのコンソールから状態を確認・変更できる（例：`__game.progress.setState({ stars: 24 })` で Lv3 を試す）
- `?reset-progress`：集めた星・地図の記録・図鑑を消して Lv1 から
- `window.__game` には `input`（inputStore。`setAxes('keyboard', {boom: -1})` でレバーを入れられる）・`scrap`（scrapRegistry）・`scrapStore`・`building`・`city`（cityStore）もある
- `window.__game` には `collection`（collectionStore）・`dirt`（dirtRegistry）・`exploration`（explorationStore）・`renderer` もある
- **ファイル名は大文字・小文字だけ違う名前にしない**（Windows では同じファイル扱いになり、tsc が TS1149 で止まる）。例：`DayNight.tsx` と `dayNightState.ts`、`Water.tsx` と `waterLayout.ts`
- ヘッドレス Chrome（ソフトウェア描画）は約 9fps しか出ず、`dt` を 1/20 秒で打ち切っているためゲーム内の時間が実時間より遅く進む。自動テストではキーを長めに押すこと

## 既知の事項

ブラウザのコンソールに警告が 2 件出るが、どちらもライブラリ内部が原因でアプリのコードの問題ではない（ライブラリ側の更新待ち）：

- `THREE.Clock: This module has been deprecated`：@react-three/fiber 9.8 の内部が THREE.Clock を使っている
- `using deprecated parameters for the initialization function`：@react-three/rapier 2.2 が Rapier の `init()` を古い呼び方で呼んでいる

そのほか：

- kinematic ボディの Collider に `setEnabled(false)` しても、岩との接触が消えなかった（`isEnabled()` は false を返す）。
  出し入れしたい当たり判定は別の kinematic ボディにし、`setTranslation` で地面の下へ退避させる（ダンプのあおりで採用）
- ショベルのブーム・アームとダンプの車体は当たり判定どうし（kinematic 同士）がぶつからないので、腕を下げるとダンプを突き抜けて見える。
  バケット先端だけは `digFloors` で荷台の床より下へ入らないようにしている
