using System;
using System.Collections.Generic;
using System.Linq;
using Windows.Security.Credentials;

using Microsoft.ReactNative.Managed;
using Microsoft.ReactNative;

namespace RNSensitiveInfo
{
    [ReactModule("RNSensitiveInfo")]
    class RNSensitiveInfoModule
    {
        
        [ReactMethod]
        public void getItem(string key, JSValue options, IReactPromise<string> promise)
        {
            if (string.IsNullOrEmpty(key))
            {
                promise.Reject(new ReactError { Exception = new ArgumentNullException("KEY IS REQUIRED") });
                return;
            }

            try
            {
                string name = sharedPreferences(options);

                var credential = prefs(name, key);
                if (credential != null)
                {
                    promise.Resolve(credential.Password);
                }
                else
                {
                    throw new Exception("credential NOT FOUND");
                }
            }
            catch (Exception ex)
            {
                promise.Reject(new ReactError { Message = "ERROR GET : " + ex.Message });
            }
        }

        [ReactMethod]
        public void setItem(string key, string value, JSValue options, IReactPromise<string> promise)
        {
            if (string.IsNullOrEmpty(key))
            {
                promise.Reject(new ReactError { Exception = new ArgumentNullException("KEY IS REQUIRED") });
                return;
            }

            try
            {
                string name = sharedPreferences(options);
                putExtra(key, value, name);

                promise.Resolve(value);
            }
            catch (Exception ex)
            {
                promise.Reject(new ReactError { Message = "ERROR SET : " + ex.Message });
            }
        }

        [ReactMethod]
        public void deleteItem(string key, JSValue options, IReactPromise<string> promise)
        {
            if (string.IsNullOrEmpty(key))
            {
                promise.Reject(new ReactError { Exception = new ArgumentNullException("KEY IS REQUIRED") });
                return;
            }

            try
            {
                string name = sharedPreferences(options);
                var vault = new PasswordVault();
                var credential = vault.Retrieve(name, key);
                vault.Remove(credential);

                promise.Resolve(key);
            }
            catch (Exception ex)
            {
                promise.Reject(new ReactError { Message = "ERROR DELETE : " + ex.Message });
            }
        }

        [ReactMethod]
        public void getAllItems(JSValue options, IReactPromise<JSValue> promise)
        {
            try
            {
                string name = sharedPreferences(options);
                JSValueObject ret = new JSValueObject();

                var vault = new PasswordVault();
                var credentialList = vault.FindAllByResource(name);
                if (credentialList.Count > 0)
                {
                    credentialList.ToList().ForEach(item =>
                    {
                        var credential = prefs(name, item.UserName);
                        ret[item.UserName] = credential.Password;
                    });

                }
                promise.Resolve(ret);
            }
            catch (Exception ex)
            {
                promise.Reject(new ReactError { Message = "ERROR GET ALL : " + ex.Message });
            }
        }

        private PasswordCredential prefs(string name, string key)
        {
            PasswordCredential credential = null;

            var vault = new PasswordVault();
            return vault.Retrieve(name, key);
        }

        private void putExtra(string key, string value, string name)
        {
            try
            {
                var vault = new PasswordVault();
                vault.Add(new PasswordCredential(name, key, value));
            }
            catch (Exception e)
            {
                throw new Exception("ERROR SAVE PasswordVault " + e.Message);
            }

        }

        private string sharedPreferences(JSValue options)
        {
            JSValue val;
            var opt = options.AsObject();
            if (opt.TryGetValue("sharedPreferencesName", out val))
            {
                return val.AsString();
            }
            else
            {
                return "shared_preferences";
            }
        }

    }
}
