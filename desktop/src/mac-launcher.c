#include <dlfcn.h>
#include <limits.h>
#include <mach-o/dyld.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// Dispatch STDIO before loading Electron: initializing AppKit registers the PID
// with LaunchServices, and exec() cannot remove that application registration.
int main(int argc, char **argv) {
  char executable[PATH_MAX], resolved[PATH_MAX], target[PATH_MAX];
  uint32_t size = sizeof(executable);
  if (_NSGetExecutablePath(executable, &size) != 0 ||
      realpath(executable, resolved) == NULL) {
    perror("Cannot locate Plasmic executable");
    return 1;
  }
  char *name = strrchr(resolved, '/');
  if (name == NULL) return 1;
  *name = '\0';
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--mcp") != 0) continue;
    if (snprintf(target, sizeof(target), "%s/../Resources/mcp/plasmic-mcp", resolved) >= (int)sizeof(target)) return 1;
    char *args[] = {target, NULL};
    execv(target, args);
    perror("Cannot start Plasmic MCP");
    return 1;
  }
  if (snprintf(target, sizeof(target), "%s/../Frameworks/Electron Framework.framework/Electron Framework", resolved) >= (int)sizeof(target)) return 1;
  // Native Node addons resolve Node-API symbols from the Electron framework.
  void *framework = dlopen(target, RTLD_NOW | RTLD_GLOBAL);
  if (framework == NULL) {
    fprintf(stderr, "Cannot load Electron: %s\n", dlerror());
    return 1;
  }
  int (*electronMain)(int, char **) = dlsym(framework, "ElectronMain");
  if (electronMain == NULL) {
    fprintf(stderr, "Cannot load ElectronMain: %s\n", dlerror());
    return 1;
  }
  return electronMain(argc, argv);
}
