require("./runtime-security.cjs").configureProductionRuntime(require("electron").app);
require("./main.cjs").bootstrap();
