# Subir el proyecto a GitHub

Usar **Git Bash** (el terminal que viene con Git for Windows / GitHub), no el bash integrado de Cursor ni CMD.

---

## Usuario correcto (dueño del proyecto)

Si Cursor o Git guardan los commits con **otro usuario** (ej. tucsdigital@gmail.com) y no con **tucsdigital1@gmail.com**, hacé una de estas dos cosas.

### Opción A: Que Git use siempre este usuario solo en este repo (recomendado)

Así Cursor y Git usarán **tucsdigital1@gmail.com** cada vez que trabajes en esta carpeta.

1. Abrí tu **config global de Git** en un editor:
   - Windows: `C:\Users\TU_USUARIO\.gitconfig` (reemplazá TU_USUARIO por tu nombre de usuario de Windows; en tu caso sería `C:\Users\Lauti\.gitconfig`).
   - O en Git Bash: `notepad ~/.gitconfig`
2. Al **final del archivo** agregá (ajustá la ruta si tu proyecto está en otra carpeta):

```ini
[includeIf "gitdir:C:/Users/Lauti/Documents/GitHub/momentaneo/"]
	path = C:/Users/Lauti/Documents/GitHub/momentaneo/.gitconfig
```

3. Guardá el archivo. A partir de ahí, cada vez que hagas un commit **dentro de momentaneo**, Git usará el usuario del archivo `.gitconfig` del repo (tucsdigital1@gmail.com / lautaro maza). No hace falta volver a configurar nada.

### Opción B: Configurar solo este repo a mano

En **Git Bash**, dentro de la carpeta del proyecto, ejecutá **una vez**:

```bash
bash configurar-usuario-git.sh
```

O a mano:

```bash
git config user.email "tucsdigital1@gmail.com"
git config user.name "lautaro maza"
```

Eso escribe la identidad en `.git/config` de este repo. A veces Cursor o otra herramienta puede no tomarla; si sigue guardando con otro usuario, usá la **Opción A**.

## Pasos

1. Abrí **Git Bash** (Menú Inicio → "Git Bash", o clic derecho en la carpeta del proyecto → "Git Bash Here").
2. Entrá al proyecto:
   ```bash
   cd /c/Users/Lauti/Documents/GitHub/momentaneo
   ```
3. Ejecutá el script:
   ```bash
   bash setup-github.sh
   ```

## Comandos manuales (en Git Bash)

Si preferís ejecutarlos uno por uno:

```bash
git config user.email "tucsdigital1@gmail.com"
git config user.name "lautaro maza"
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/tucsdigital-2/elsherpa.git
git push -u origin main
```

**Usuario:** tucsdigital1@gmail.com / lautaro maza  
**Repositorio:** https://github.com/tucsdigital-2/elsherpa.git

Si al hacer `git push` ves **"Repository not found"**: el repo aún no existe en GitHub. Crealo primero en https://github.com/new (nombre: `elsherpa`, organización/usuario: `tucsdigital-2`, sin README ni .gitignore). Después volvé a ejecutar solo el push: `git push -u origin main`.

---

## Autenticación con Personal Access Token (classic)

GitHub ya no acepta contraseña de la cuenta para `git push` por HTTPS. Hay que usar un **Personal Access Token (classic)**.

### 1. Crear el token en GitHub

1. Entrá a **https://github.com/settings/tokens**
2. Clic en **"Generate new token"** → **"Generate new token (classic)"**
3. **Note:** por ejemplo `elsherpa` o `push desde PC`
4. **Expiration:** elegí una duración (ej. 90 días o No expiration)
5. **Scopes:** marcá **repo** (acceso completo a repositorios privados y públicos)
6. Clic en **"Generate token"**
7. **Copiá el token** (solo se muestra una vez). Guardalo en un lugar seguro.

### 2. Usar el token al hacer push

Cuando ejecutes `git push -u origin main`, Git pedirá usuario y contraseña:

- **Username:** tu usuario de GitHub (ej. `tucsdigital-2` o el que corresponda)
- **Password:** pegá el **token** (no la contraseña de la cuenta)

En Windows, Git Credential Manager suele guardar el token; las próximas veces no te lo pedirá.

### 3. Opción: poner el token en la URL del remoto (solo en tu máquina)

Si querés que no te pregunte cada vez, podés configurar el remoto con el token (**no subas este comando a ningún repo**):

```bash
git remote set-url origin https://TU_USUARIO:TU_TOKEN@github.com/tucsdigital-2/elsherpa.git
```

Reemplazá `TU_USUARIO` por tu usuario de GitHub y `TU_TOKEN` por el token. Después `git push -u origin main` funcionará sin pedir nada.

**Importante:** no compartas el token ni lo subas a GitHub. Si lo pusiste en la URL, no hagas `git push` de archivos que contengan esa URL.

---

## Empezar de cero (borrar lo iniciado)

Si hiciste un error y querés borrar el repo local y volver a subir todo:

1. En **Git Bash**, dentro de la carpeta del proyecto, ejecutá:
   ```bash
   bash empezar-de-cero.sh
   ```
   Ese script borra la carpeta `.git`, hace de nuevo `git init`, `add`, `commit`, `branch -M main`, `remote add origin` y `push`.

2. Si preferís hacerlo a mano: borrá la carpeta `.git` (clic derecho → Eliminar, o en Git Bash: `rm -rf .git`). Después ejecutá `bash setup-github.sh`.
