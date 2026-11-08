import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const destination = path.join(root, '.cache/client-patch-checks');
await mkdir(destination, { recursive: true });
const score = await readFile(path.join(root, 'examples/starcraft-scoreboard/StarcraftScoreboard.cs'), 'utf8');
const helpers = score.slice(score.indexOf('    public sealed class ScoreboardState'), score.lastIndexOf('\n}'))
  .replace('    private sealed class ScoreboardNetwork', '    public sealed class ScoreboardNetwork');
await writeFile(path.join(destination, 'UnderTest.cs'),
  'using System.Globalization;\nusing Photon.Pun;\nusing Photon.Realtime;\nusing PhotonHashtable = ExitGames.Client.Photon.Hashtable;\nusing UnityEngine;\npublic static class StarcraftScoreboard {\n' + helpers + '\n}');
const movement = await readFile(path.join(root, 'examples/leading-model/LeadingMovement.cs'), 'utf8');
function method(name) {
  const position = movement.indexOf(name + '(');
  const start = movement.lastIndexOf('\n', position) + 1;
  const brace = movement.indexOf('{', position);
  let depth = 1;
  let end = brace + 1;
  while (depth) {
    if (movement[end] === '{') depth++;
    if (movement[end] === '}') depth--;
    end++;
  }
  return movement.slice(start, end);
}
await writeFile(path.join(destination, 'MovementUnderTest.cs'), `
namespace MovementCheck {
public class GameItem {}
public class Cloud {}
public class Unit : GameItem { public object Formation=new Cloud(); }
public class Soldier : GameItem { public Unit Parent; public Unit GetParentUnit()=>Parent; }
public class InputManager {
public List<GameItem> Selected=new(); public int Forced;
public List<GameItem> GetCurrentSelection()=>Selected;
public void ForceSingleSeletion(GameItem item) { Forced++;Selected=new(){item}; }
public void MouseDrag(GameItem item) {}
}
public static class LeadingMovement {
private static Soldier pendingDrag;
private static Unit selectionAfterDrag;
public static bool multiDrag;
private static bool Eligible(Soldier model)=>model!=null;
public static void Pending(Soldier model)=>pendingDrag=model;
${['HasSelectedGroup','SelectionTarget','PrepareSingleDrag'].map(method).join('\n')}
}}
namespace UnityEngine {
public static class Object { public static object Instance; public static T FindFirstObjectByType<T>()=>(T)Instance; }
}`);
for (const name of ['Program.cs', 'Stubs.cs'])
  await writeFile(path.join(destination, name), await readFile(path.join(here, name)));
await writeFile(path.join(destination, 'Checks.csproj'), `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><LangVersion>latest</LangVersion><NuGetAudit>false</NuGetAudit></PropertyGroup></Project>`);
const result = spawnSync(process.env.DOTNET_EXECUTABLE ?? 'dotnet',
  ['run', '--project', path.join(destination, 'Checks.csproj'), '--source', destination],
  { stdio: 'inherit' });
process.exit(result.status ?? 1);
