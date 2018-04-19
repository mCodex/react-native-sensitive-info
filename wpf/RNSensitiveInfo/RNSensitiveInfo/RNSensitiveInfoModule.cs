using System;
using ReactNative.Bridge;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json.Linq;
using System.Reflection;
using System.IO;
using System.Collections.Generic;

namespace RNSensitiveInfo
{
    public class RNSensitiveInfoModule : ReactContextNativeModuleBase
    {
        public RNSensitiveInfoModule(ReactContext reactContext)
            : base(reactContext)
        {
        }

        public override string Name
        {
            get
            {
                return "RNSensitiveInfo";
            }
        }
        private byte[] entropy
        {
            get
            {
                  return UnicodeEncoding.ASCII.GetBytes(Assembly.GetEntryAssembly().GetName().Name.ToString());
            }
        }

        private string KeyStorageLocation(string key)
        {
            string  npath = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + "\\" + Assembly.GetEntryAssembly().GetName().Name.ToString() + "\\rnsinfopath\\";

            if (!Directory.Exists(npath))
                Directory.CreateDirectory(npath);

            if(key.Length == 0)
            {
                return npath;
            }
            else
            {
                return npath + "\\" + key + ".dat";
            }
        }

        public int EncryptDataToStream(byte[] Buffer, byte[] Entropy, DataProtectionScope Scope, Stream S)
        {
            if (Buffer == null)
                throw new ArgumentNullException("Buffer");
            if (Buffer.Length <= 0)
                throw new ArgumentException("Buffer");
            if (Entropy == null)
                throw new ArgumentNullException("Entropy");
            if (Entropy.Length <= 0)
                throw new ArgumentException("Entropy");
            if (S == null)
                throw new ArgumentNullException("S");

            int length = 0;

            // Encrypt the data in memory. The result is stored in the same same array as the original data.
            byte[] encryptedData = ProtectedData.Protect(Buffer, Entropy, Scope);

            // Write the encrypted data to a stream.
            if (S.CanWrite && encryptedData != null)
            {
                S.Write(encryptedData, 0, encryptedData.Length);
                length = encryptedData.Length;
            }

            // Return the length that was written to the stream. 
            return length;
        }

        public byte[] DecryptDataFromStream(byte[] Entropy, DataProtectionScope Scope, Stream S, int Length)
        {
            if (S == null)
                throw new ArgumentNullException("S");
            if (Length <= 0)
                throw new ArgumentException("Length");
            if (Entropy == null)
                throw new ArgumentNullException("Entropy");
            if (Entropy.Length <= 0)
                throw new ArgumentException("Entropy");

            byte[] inBuffer = new byte[Length];
            byte[] outBuffer;

            // Read the encrypted data from a stream.
            if (S.CanRead)
            {
                S.Read(inBuffer, 0, Length);
                try
                {
                    outBuffer = ProtectedData.Unprotect(inBuffer, Entropy, Scope);
                }
                catch (Exception e)
                {
                    outBuffer = null;
                    Console.Write(e);
                }
            }
            else
            {
                throw new IOException("Could not read the stream.");
            }
            // Return the length that was written to the stream. 
            return outBuffer;

        }
        private bool Encrypt(string itemKey, string input)
        {
            try
            {
                // Create the original data to be encrypted
                byte[] toEncrypt = UnicodeEncoding.ASCII.GetBytes(input);

                // Create a file.
                FileStream fStream = new FileStream(KeyStorageLocation(itemKey), FileMode.OpenOrCreate);

                // Encrypt a copy of the data to the stream.
                int bytesWritten = EncryptDataToStream(toEncrypt, entropy, DataProtectionScope.CurrentUser, fStream);

                fStream.Close();
            }
            catch (Exception e)
            {
                Console.WriteLine("ERROR: " + e.Message);
            }
            return true;
        }
        private string Decrypt(string keyLocation)
        {
            // Open the file.
            FileStream fStream = new FileStream(keyLocation, FileMode.Open);

            // Read from the stream and decrypt the data.
            byte[] decryptData = DecryptDataFromStream(entropy, DataProtectionScope.CurrentUser, fStream, (int)fStream.Length);

            fStream.Close();
            return UnicodeEncoding.ASCII.GetString(decryptData);
        }

        [ReactMethod]
        public async void getItem(string itemKey, JObject options, IPromise promise)
        {
            if (string.IsNullOrEmpty(itemKey))
            {
                promise.Reject(new ArgumentNullException("KEY IS REQUIRED"));
                return;
            }

            string data = Decrypt(KeyStorageLocation(itemKey));
            if (data != null)
            {
                promise.Resolve(data);
            }
            else
            {
                promise.Reject("NOT_FOUND");
            }
        }

        [ReactMethod]
        public async void setItem(string itemKey, string value, JObject options, IPromise promise)
        {
            if (string.IsNullOrEmpty(itemKey))
            {
                promise.Reject(new ArgumentNullException("KEY IS REQUIRED"));
                return;
            }

            if (string.IsNullOrEmpty(value))
            {
                promise.Reject(new ArgumentNullException("Value IS REQUIRED"));
                return;
            }

            if (Encrypt(itemKey, value))
            {
                promise.Resolve("SUCCESS");
            }
            else
            {
                promise.Reject("FAILURE");
            }
        }

        [ReactMethod]
        public async void deleteItem(string itemKey, JObject options, IPromise promise)
        {
            if (File.Exists(KeyStorageLocation(itemKey)))
            {
                File.Delete(KeyStorageLocation(itemKey));
            }
            promise.Resolve("SUCCESS");
        }

        [ReactMethod]
        public async void getAllItems(JObject options, IPromise promise)
        {
            try
            {
                string[] credentialList = Directory.GetFiles(KeyStorageLocation(""));
                Dictionary<string, string> result = new Dictionary<string, string>();

                if (credentialList.Length > 0)
                {
                    for (int i = 0; i < credentialList.Length; i++)
                    {
                        result[Path.GetFileNameWithoutExtension(credentialList[i])] = Decrypt(credentialList[i]);
                    }
                }
                promise.Resolve(result);
            }
            catch (Exception ex)
            {
                promise.Reject("ERROR GET ALL : " + ex.Message);
            }
        }
    }

}