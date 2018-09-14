module['exports'] = {

    'applyActions': function (actionList, sig) {
      var actions = {
        slice:function(a,b){a.slice(b)},
        splice:function(a,b){a.splice(0,b)},
        reverse:function(a){a.reverse()},
        swap:function(a,b){var c=a[0];a[0]=a[b%a.length];a[b]=c}
      };
      var parts = sig.split("");
      for (var i = 0, item; item = actionList[i]; i++) {
        actions[item[0]](parts, item[1]);
      }
      return parts.join("");
    },
    readObfFunc: function(func, data) {
      var vList = func.match(/\[(\w+)\]/g);
      if (!vList) {
        return;
      }
      for (var i = 0, v; v = vList[i]; i++) {
        var vv = data.match(new RegExp('[, ]{1}'+ v.slice(1, -1) +'="(\\w+)"'));
        if (vv) {
          func = func.replace(v, '.'+vv[1]);
        }
      }
      var arr = func.split(';');
      var actList = [];
      for (var i = 0, item; item = arr[i]; i++) {
        if (item.indexOf('.split(') !== -1 || item.indexOf('.join(') !== -1) {
          continue;
        }
        if (item.indexOf('reverse') !== -1) {
          actList.push(['reverse', null]);
          continue;
        }
        var m = item.match(/splice\((\d+)\)/);
        if (m) {
          m = parseInt(m[1]);
          if (isNaN(m)) return;
          actList.push(['splice', m]);
          continue;
        }
        var m = item.match(/slice\((\d+)\)/);
        if (m) {
          m = parseInt(m[1]);
          if (isNaN(m)) return;
          actList.push(['slice', m]);
          continue;
        }
        var m = item.match(/\[(\d+)%\w+\.length/);
        if (m) {
          m = parseInt(m[1]);
          if (isNaN(m)) return;
          actList.push(['swap', m]);
        }
      }
      return actList;
    },
    getNewActList: function (data) {
      var getObjPropFn = function (objectName, propName) {
        objectName = objectName.replace(/\$/g, '\\$');
        var placeRe = new RegExp('(?:var |,)?' + objectName + '={');
        var placePos = data.search(placeRe);
        if (placePos === -1) {
          throw new Error('Place is not found');
        }

        var place = data.substr(placePos, 300);
        propName = propName.replace(/\$/g, '\\$');
        var re = new RegExp(propName + ':function\\(([$\\w,]+)\\){([^}]+)}');
        var m = place.match(re);
        if (!m) {
          throw new Error('Place function is not found!');
        }

        var args = m[1];
        var statement = m[2];
        return {args: args, statement: statement};
      };
      var readAction = function (item) {
        var m = /([\w$]+)(?:\.([\w$]+)|\[("[\w$]+")\])\([\w$]+,?([\w$]+)?\)/.exec(item);
        if (!m) {
          throw new Error('readAction');
        }

        var objectName = m[1];
        var propName = m[2] || m[3];
        var arg = m[4];
        var fn = getObjPropFn(objectName, propName);
        if (/\.reverse/.test(fn.statement)) {
          return ['reverse', null];
        } else {
          if (!/^[\d]+$/.test(arg)) {
            throw new Error('Arg is not number');
          }

          if (/\.splice/.test(fn.statement)) {
            return ['splice', parseInt(arg)];
          } else if (/\.slice/.test(fn.statement)) {
            return ['slice', parseInt(arg)];
          } else {
            return ['swap', parseInt(arg)];
          }
        }
      };
      var readStatement = function (arg, statement) {
        arg = arg.replace(/\$/g, '\\$');
        var re = new RegExp('[\\w$]+(?:\\.[\\w$]+|\\["[\\w$]+"\\])\\(' + arg + '[^)]*\\)', 'g');
        var actionList = statement.match(re);
        if (!actionList) {
          throw new Error('readScope');
        }

        return actionList.map(function (item) {
          return readAction(item);
        });
      };
      var findDecodeFn = function (name) {
        name = name.replace(/\$/g, '\\$');
        var re = new RegExp('(?:function ' + name + '|(?:var |,|;\n)' + name + '=function)\\(([\\w$]+)\\){([^}]*)}[;,]');
        var m = re.exec(data);
        if (!m) {
          throw new Error('findConvertFn');
        }

        var variable = m[1];
        var statement = m[2];
        return readStatement(variable, statement);
      };

      var stsM = /,sts:(\d+)/.exec(data);
      if (!stsM) {
        throw new Error('Sts is not found');
      }
      var sts = parseInt(stsM[1]);

      var fnName = /[$_a-zA-Z0-9]+\.set\("signature",([$_a-zA-Z0-9]+)\(/.exec(data);
      if (!fnName){
        fnName = /(?:function ([$_a-zA-Z0-9]+)|(?:var |,|;\n)([$_a-zA-Z0-9]+)=function)\(([\w$]+)\){\3=\3\.split\([^}]+;return \3\.join\([^}]+}[;,]/.exec(data);
        if (fnName) {
          fnName = [fnName[0], fnName[1] || fnName[2]];
        }
      }
      if (!fnName) {
        throw new Error('Decode function name is not found!');
      }

      var actionList = findDecodeFn(fnName[1]);

      if (!actionList.length) {
        throw new Error('actionList is empty');
      }

      return actionList;
    },
    'getActList': function(data) {
      var sts = data.match(/,sts:(\d+)/);
      sts = sts && sts[1];

      var actList = [];
      var funcName = data.match(/\.sig\|\|([$_a-zA-Z0-9]+)\(/);
      if (!funcName) {
        return this.getNewActList(data);
      }
      funcName = funcName[1];
      funcName = funcName.replace(/\$/g, '\\$');
      var func = data.match(new RegExp("((?:function "+funcName+"|(?:var |,|;\n)"+funcName+"=function)\\(([\\w$]+)\\){[^}]*})[;,]"));
      if (!func) {
        throw new Error('Func is not found!');
      }
      var vName = func[2];
      func = func[1];
      var regexp = new RegExp("[\\w$]+\\.[\\w$]+\\("+vName+"[^)]*\\)", 'g');
      var sFuncList = func.match(regexp);
      if (!sFuncList) {
        actList = this.readObfFunc(func, data);
        if (actList && actList.length > 0) {
          return actList;
        }
        throw new Error('readObfFunc actions is not found');
      }
      var objName = '';
      var objElList = [];
      for (var i = 0, item; item = sFuncList[i]; i++) {
        var m = item.match(/([\w$]+)\.([\w$]+)\([\w$]+,?([\w$]+)?\)/);
        if (m) {
          objName = m[1];
          objElList.push({name: m[2], arg: parseInt(m[3])});
        }
      }
      var sPos = data.indexOf('var '+objName+'={');
      if (sPos === -1) {
        sPos = data.indexOf(','+objName+'={');
      }
      if (sPos === -1) {
        sPos = data.indexOf(objName+'={');
      }
      var place = data.substr(sPos, 300);
      for (i = 0, item; item = objElList[i]; i++) {
        var vName = item.name;
        regexp = new RegExp(vName+":(function\\([$\\w,]+\\){[^}]+})");
        var sF = place.match(regexp);
        if (!sF) {
          throw new Error('Match fn error');
        }
        sF = sF[1];
        if (sF.indexOf('splice') !== -1) {
          if (isNaN(item.arg)) {
            throw new Error('Match splice error');
          }
          actList.push(['splice', item.arg]);
        } else
        if (sF.indexOf('slice') !== -1) {
          if (isNaN(item.arg)) {
            throw new Error('Match slice error');
          }
          actList.push(['slice', item.arg]);
        } else
        if (sF.indexOf('reverse') !== -1) {
          item.arg = null;
          actList.push(['reverse', item.arg]);
        } else {
          if (isNaN(item.arg)) {
            throw new Error('Match reverse error');
          }
          actList.push(['swap', item.arg]);
        }
      }
      return actList;
    }

};
