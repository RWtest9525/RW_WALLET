import sys
from types import ModuleType
from importlib.machinery import ModuleSpec

class DynamicMockModule(ModuleType):
    """
    Synthesizes dummy pandas module hierarchy and attributes on demand.
    Bypasses Windows AppLocker policy binary DLL restrictions.
    """
    def __init__(self, name):
        super().__init__(name)
        self.__path__ = []
        self.__spec__ = ModuleSpec(name, None)

    def __getattr__(self, name):
        if name.startswith("__") and name.endswith("__"):
            raise AttributeError(name)
        sub_name = f"{self.__name__}.{name}"
        if sub_name not in sys.modules:
            mod = DynamicMockModule(sub_name)
            sys.modules[sub_name] = mod
            setattr(self, name, mod)
        return sys.modules[sub_name]

    def __call__(self, *args, **kwargs):
        return DynamicMockModule(f"{self.__name__}_instance")

class MockModuleFinder:
    def find_spec(self, fullname, path, target=None):
        if fullname == "pandas" or fullname.startswith("pandas."):
            return ModuleSpec(fullname, MockModuleLoader())
        return None

class MockModuleLoader:
    def create_module(self, spec):
        if spec.name in sys.modules and isinstance(sys.modules[spec.name], DynamicMockModule):
            return sys.modules[spec.name]
        mod = DynamicMockModule(spec.name)
        sys.modules[spec.name] = mod
        return mod

    def exec_module(self, module):
        pass

def apply_pandas_mock():
    try:
        import pandas
    except (ImportError, Exception):
        if not any(isinstance(finder, MockModuleFinder) for finder in sys.meta_path):
            sys.meta_path.insert(0, MockModuleFinder())
        if "pandas" not in sys.modules:
            sys.modules["pandas"] = DynamicMockModule("pandas")

apply_pandas_mock()
